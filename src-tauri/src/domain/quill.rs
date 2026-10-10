//! Quill, writing (docs/features/08-quill.md, M9, ADR 0009): stories, their
//! chapters, and each chapter's drafts. A chapter has one current draft: it
//! counts for the words of the story and for the links to the cards it
//! mentions (the chapter is the links' source). Stories are not World
//! documents: they live in the Quill tab only.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use specta::Type;
use sqlx::{Sqlite, SqlitePool, Transaction};
use uuid::Uuid;

use crate::db;
use crate::db::quill::{
    self as queries, ChapterRow, DraftInfoRow, DraftRow, NoteRow, StoryListRow, StoryRow,
};
use crate::domain::content;
use crate::domain::documents::{now, validate_title};
use crate::domain::links::{self, LinkKind};
use crate::error::{AppError, AppResult};
use crate::world::assets;

mod audio;
pub mod reader;

pub use audio::{
    AudioCue, CUE_ATTR, CUE_MARK, CueKind, CuePatch, create_cue, delete_cue, draft_cues, update_cue,
};
pub use reader::{ReaderSettings, reader_settings, save_reader_settings};

/// Longest note, in characters.
pub const MAX_NOTE_CHARS: usize = 20_000;

/// The mark that anchors a note to its passage, in a draft's content.
pub const NOTE_MARK: &str = "note";

/// Largest world panel layout, in bytes of JSON.
pub const MAX_PANEL_BYTES: usize = 512 * 1024;

/// Largest draft, in bytes of JSON.
pub const MAX_DRAFT_BYTES: usize = 8 * 1024 * 1024;

/// The content of a new, empty draft: one empty paragraph.
pub const EMPTY_DRAFT: &str = r#"{"type":"doc","content":[{"type":"paragraph"}]}"#;

/// The finish of a book's cover.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum BookFinish {
    #[default]
    Cloth,
    Leather,
    Paper,
}

/// How the book looks: its colour and the finish of its cover.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct BookStyle {
    /// CSS `#rrggbb`.
    pub color: String,
    pub finish: BookFinish,
}

impl Default for BookStyle {
    fn default() -> Self {
        Self {
            color: "#2f4b6e".into(),
            finish: BookFinish::Cloth,
        }
    }
}

/// Where the title sits on the cover.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum TitlePosition {
    Top,
    #[default]
    Middle,
    Bottom,
}

/// The cover: an image of the media library, and where the title sits.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Cover {
    pub asset_id: Option<String>,
    pub title_position: TitlePosition,
}

/// A story, as listed in the Quill tab.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Story {
    pub id: String,
    pub title: String,
    pub book_style: BookStyle,
    pub cover: Cover,
    pub chapter_count: u32,
    /// Words of the chapters' current drafts.
    pub word_count: u32,
    pub created_at: String,
    pub updated_at: String,
}

/// A draft, without its content.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DraftInfo {
    pub id: String,
    pub name: String,
    pub word_count: u32,
    pub updated_at: String,
}

/// A chapter, with its drafts in their order.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Chapter {
    pub id: String,
    pub story_id: String,
    pub title: String,
    pub current_draft_id: String,
    pub header_asset_id: Option<String>,
    /// Words of the current draft.
    pub word_count: u32,
    pub drafts: Vec<DraftInfo>,
}

/// A story and its chapters in their order: the writing space's left column.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct StoryOutline {
    pub story: Story,
    pub chapters: Vec<Chapter>,
}

/// A draft with its content (a TipTap document, as JSON).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Draft {
    pub id: String,
    pub chapter_id: String,
    pub name: String,
    pub content: String,
    pub word_count: u32,
    pub updated_at: String,
}

/// What the story creation screen sends. The names of the first chapter and
/// draft are translated by the front.
#[derive(Debug, Clone, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct NewStory {
    pub title: String,
    pub book_style: BookStyle,
    pub cover: Cover,
    pub chapter_title: String,
    pub draft_name: String,
}

/// Changes to a story; a field left out stays.
#[derive(Debug, Clone, Default, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct StoryPatch {
    pub title: Option<String>,
    pub book_style: Option<BookStyle>,
    pub cover: Option<Cover>,
}

fn invalid(message: impl Into<String>) -> AppError {
    AppError::InvalidInput(message.into())
}

fn count(value: i64) -> u32 {
    u32::try_from(value.max(0)).unwrap_or(u32::MAX)
}

fn check_style(style: &BookStyle) -> AppResult<()> {
    let hex = style.color.strip_prefix('#').unwrap_or("");
    if hex.len() != 6 || !hex.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(invalid(format!(
            "a book colour is #rrggbb: {}",
            style.color
        )));
    }
    Ok(())
}

fn check_asset(id: Option<&str>) -> AppResult<()> {
    match id {
        Some(id) if !assets::is_valid_id(id) => Err(invalid(format!("invalid asset id: {id:?}"))),
        _ => Ok(()),
    }
}

fn to_json<T: Serialize>(value: &T) -> AppResult<String> {
    serde_json::to_string(value).map_err(|error| AppError::Internal(error.to_string()))
}

/// A stored book style, read with tolerance: a missing or unknown field
/// takes its default.
pub fn read_style(json: &str) -> BookStyle {
    let value: Value = serde_json::from_str(json).unwrap_or_default();
    let default = BookStyle::default();
    let color = value
        .get("color")
        .and_then(Value::as_str)
        .map(str::to_owned)
        .filter(|color| {
            check_style(&BookStyle {
                color: color.clone(),
                finish: BookFinish::Cloth,
            })
            .is_ok()
        })
        .unwrap_or(default.color);
    let finish = value
        .get("finish")
        .and_then(|finish| serde_json::from_value(finish.clone()).ok())
        .unwrap_or_default();
    BookStyle { color, finish }
}

/// A stored cover, read with tolerance like the book style.
pub fn read_cover(json: &str) -> Cover {
    let value: Value = serde_json::from_str(json).unwrap_or_default();
    Cover {
        asset_id: value
            .get("assetId")
            .and_then(Value::as_str)
            .filter(|id| assets::is_valid_id(id))
            .map(str::to_owned),
        title_position: value
            .get("titlePosition")
            .and_then(|position| serde_json::from_value(position.clone()).ok())
            .unwrap_or_default(),
    }
}

fn story_of(row: StoryListRow) -> Story {
    Story {
        id: row.id,
        title: row.title,
        book_style: read_style(&row.book_style),
        cover: read_cover(&row.cover),
        chapter_count: count(row.chapter_count),
        word_count: count(row.word_count),
        created_at: row.created_at,
        updated_at: row.updated_at,
    }
}

fn draft_info(row: DraftInfoRow) -> DraftInfo {
    DraftInfo {
        id: row.id,
        name: row.name,
        word_count: count(row.word_count),
        updated_at: row.updated_at,
    }
}

fn chapter_of(row: ChapterRow, drafts: Vec<DraftInfo>) -> Chapter {
    let current = row
        .current_draft_id
        .filter(|id| drafts.iter().any(|draft| &draft.id == id))
        .or_else(|| drafts.first().map(|draft| draft.id.clone()))
        .unwrap_or_default();
    let word_count = drafts
        .iter()
        .find(|draft| draft.id == current)
        .map_or(0, |draft| draft.word_count);
    Chapter {
        id: row.id,
        story_id: row.story_id,
        title: row.title,
        current_draft_id: current,
        header_asset_id: row.header_asset_id,
        word_count,
        drafts,
    }
}

/// The text of a draft's content, its words and the cards it mentions,
/// once the content is checked (a TipTap document, bounded).
fn read_draft(json: &str) -> AppResult<(String, i64, Vec<String>)> {
    if json.len() > MAX_DRAFT_BYTES {
        return Err(invalid(format!(
            "a draft holds at most {MAX_DRAFT_BYTES} bytes"
        )));
    }
    let doc: Value =
        serde_json::from_str(json).map_err(|error| invalid(format!("draft: {error}")))?;
    if doc.get("type").and_then(Value::as_str) != Some("doc") {
        return Err(invalid("a draft is a TipTap document"));
    }
    let text = content::doc_text(&doc);
    let words = i64::try_from(text.split_whitespace().count()).unwrap_or(i64::MAX);
    Ok((text, words, content::doc_mentions(&doc)))
}

/// Makes the chapter cite the cards its current draft mentions (ADR 0009).
async fn refresh_links(
    tx: &mut Transaction<'_, Sqlite>,
    chapter_id: &str,
    draft_content: &str,
) -> AppResult<()> {
    let (_, _, mentioned) = read_draft(draft_content)?;
    links::replace_in(tx, chapter_id, LinkKind::Mention, None, &mentioned).await
}

async fn insert_draft(
    tx: &mut Transaction<'_, Sqlite>,
    chapter_id: &str,
    name: &str,
    content_json: &str,
    order: i64,
) -> AppResult<String> {
    let (text, words, _) = read_draft(content_json)?;
    let now = now();
    let id = Uuid::new_v4().to_string();
    queries::insert_draft(
        &mut **tx,
        &DraftRow {
            id: id.clone(),
            chapter_id: chapter_id.to_owned(),
            name: validate_title(name)?,
            content: content_json.to_owned(),
            content_text: text,
            word_count: words,
            sort_order: order,
            created_at: now.clone(),
            updated_at: now,
        },
    )
    .await?;
    Ok(id)
}

/// A new chapter at `order` with one empty draft, its current one.
async fn insert_chapter(
    tx: &mut Transaction<'_, Sqlite>,
    story_id: &str,
    title: &str,
    draft_name: &str,
    order: i64,
) -> AppResult<String> {
    let now = now();
    let id = Uuid::new_v4().to_string();
    queries::insert_chapter(
        &mut **tx,
        &ChapterRow {
            id: id.clone(),
            story_id: story_id.to_owned(),
            title: validate_title(title)?,
            sort_order: order,
            current_draft_id: None,
            header_asset_id: None,
            created_at: now.clone(),
            updated_at: now.clone(),
        },
    )
    .await?;
    let draft = insert_draft(tx, &id, draft_name, EMPTY_DRAFT, 0).await?;
    queries::set_current_draft(&mut **tx, &id, &draft, &now).await?;
    Ok(id)
}

/// The stories, in their order.
pub async fn list(pool: &SqlitePool) -> AppResult<Vec<Story>> {
    Ok(queries::stories(pool)
        .await?
        .into_iter()
        .map(story_of)
        .collect())
}

/// A story and its chapters.
pub async fn outline(pool: &SqlitePool, id: &str) -> AppResult<StoryOutline> {
    let story = queries::story(pool, id)
        .await?
        .ok_or_else(|| invalid(format!("story not found: {id}")))?;
    let mut drafts = queries::story_drafts(pool, id).await?;
    let chapters = queries::chapters(pool, id)
        .await?
        .into_iter()
        .map(|row| {
            let (own, rest): (Vec<_>, Vec<_>) = drafts
                .drain(..)
                .partition(|draft| draft.chapter_id == row.id);
            drafts = rest;
            chapter_of(row, own.into_iter().map(draft_info).collect())
        })
        .collect();
    Ok(StoryOutline {
        story: story_of(story),
        chapters,
    })
}

/// Creates a story at the end of the list, with its first chapter and draft.
pub async fn create(pool: &SqlitePool, new: &NewStory) -> AppResult<StoryOutline> {
    check_style(&new.book_style)?;
    check_asset(new.cover.asset_id.as_deref())?;
    let mut tx = db::begin_write(pool).await?;
    let now = now();
    let id = Uuid::new_v4().to_string();
    let order = queries::story_count(&mut *tx).await?;
    queries::insert_story(
        &mut *tx,
        &StoryRow {
            id: id.clone(),
            title: validate_title(&new.title)?,
            book_style: to_json(&new.book_style)?,
            cover: to_json(&new.cover)?,
            sort_order: order,
            created_at: now.clone(),
            updated_at: now,
        },
    )
    .await?;
    insert_chapter(&mut tx, &id, &new.chapter_title, &new.draft_name, 0).await?;
    tx.commit().await?;
    outline(pool, &id).await
}

/// Changes a story's title, book style or cover.
pub async fn update(pool: &SqlitePool, id: &str, patch: &StoryPatch) -> AppResult<Story> {
    let current = outline(pool, id).await?.story;
    let title = match &patch.title {
        Some(title) => validate_title(title)?,
        None => current.title,
    };
    let style = patch.book_style.clone().unwrap_or(current.book_style);
    check_style(&style)?;
    let cover = patch.cover.clone().unwrap_or(current.cover);
    check_asset(cover.asset_id.as_deref())?;
    queries::update_story(
        pool,
        id,
        &title,
        &to_json(&style)?,
        &to_json(&cover)?,
        &now(),
    )
    .await?;
    Ok(outline(pool, id).await?.story)
}

/// Deletes a story for good, with its chapters, drafts, notes and links.
pub async fn delete(pool: &SqlitePool, id: &str) -> AppResult<()> {
    let mut tx = db::begin_write(pool).await?;
    for chapter in queries::chapters(&mut *tx, id).await? {
        crate::db::links::delete_all_from(&mut tx, &chapter.id).await?;
    }
    if !queries::delete_story(&mut *tx, id).await? {
        return Err(invalid(format!("story not found: {id}")));
    }
    tx.commit().await?;
    Ok(())
}

async fn chapter_row(tx: &mut Transaction<'_, Sqlite>, id: &str) -> AppResult<ChapterRow> {
    queries::chapter(&mut **tx, id)
        .await?
        .ok_or_else(|| invalid(format!("chapter not found: {id}")))
}

async fn chapter(pool: &SqlitePool, id: &str) -> AppResult<Chapter> {
    let row = queries::chapter(pool, id)
        .await?
        .ok_or_else(|| invalid(format!("chapter not found: {id}")))?;
    let drafts = queries::chapter_drafts(pool, id).await?;
    Ok(chapter_of(
        row,
        drafts.into_iter().map(draft_info).collect(),
    ))
}

/// Adds a chapter at the end of the story, with one empty draft.
pub async fn create_chapter(
    pool: &SqlitePool,
    story_id: &str,
    title: &str,
    draft_name: &str,
) -> AppResult<Chapter> {
    let mut tx = db::begin_write(pool).await?;
    if queries::story(&mut *tx, story_id).await?.is_none() {
        return Err(invalid(format!("story not found: {story_id}")));
    }
    let order =
        i64::try_from(queries::chapters(&mut *tx, story_id).await?.len()).unwrap_or(i64::MAX);
    let id = insert_chapter(&mut tx, story_id, title, draft_name, order).await?;
    queries::touch_story(&mut *tx, story_id, &now()).await?;
    tx.commit().await?;
    chapter(pool, &id).await
}

pub async fn rename_chapter(pool: &SqlitePool, id: &str, title: &str) -> AppResult<Chapter> {
    if !queries::rename_chapter(pool, id, &validate_title(title)?, &now()).await? {
        return Err(invalid(format!("chapter not found: {id}")));
    }
    chapter(pool, id).await
}

/// Sets or removes the image over the chapter's text.
pub async fn set_chapter_header(
    pool: &SqlitePool,
    id: &str,
    asset_id: Option<&str>,
) -> AppResult<Chapter> {
    check_asset(asset_id)?;
    if !queries::set_header(pool, id, asset_id, &now()).await? {
        return Err(invalid(format!("chapter not found: {id}")));
    }
    chapter(pool, id).await
}

/// Moves a chapter to `index` among its story's chapters.
pub async fn move_chapter(pool: &SqlitePool, id: &str, index: u32) -> AppResult<StoryOutline> {
    let mut tx = db::begin_write(pool).await?;
    let row = chapter_row(&mut tx, id).await?;
    let mut ids: Vec<String> = queries::chapters(&mut *tx, &row.story_id)
        .await?
        .into_iter()
        .map(|chapter| chapter.id)
        .filter(|other| other != id)
        .collect();
    let at = usize::try_from(index).unwrap_or(usize::MAX).min(ids.len());
    ids.insert(at, id.to_owned());
    for (order, chapter_id) in ids.iter().enumerate() {
        queries::set_chapter_order(
            &mut *tx,
            chapter_id,
            i64::try_from(order).unwrap_or(i64::MAX),
        )
        .await?;
    }
    tx.commit().await?;
    outline(pool, &row.story_id).await
}

/// Deletes a chapter for good, with its drafts, notes and links. A story
/// keeps at least one chapter.
pub async fn delete_chapter(pool: &SqlitePool, id: &str) -> AppResult<StoryOutline> {
    let mut tx = db::begin_write(pool).await?;
    let row = chapter_row(&mut tx, id).await?;
    let siblings = queries::chapters(&mut *tx, &row.story_id).await?;
    if siblings.len() <= 1 {
        return Err(invalid("a story keeps at least one chapter"));
    }
    crate::db::links::delete_all_from(&mut tx, id).await?;
    queries::delete_chapter(&mut *tx, id).await?;
    for (order, sibling) in siblings
        .iter()
        .filter(|sibling| sibling.id != id)
        .enumerate()
    {
        queries::set_chapter_order(
            &mut *tx,
            &sibling.id,
            i64::try_from(order).unwrap_or(i64::MAX),
        )
        .await?;
    }
    queries::touch_story(&mut *tx, &row.story_id, &now()).await?;
    tx.commit().await?;
    outline(pool, &row.story_id).await
}

async fn draft_row(tx: &mut Transaction<'_, Sqlite>, id: &str) -> AppResult<DraftRow> {
    queries::draft(&mut **tx, id)
        .await?
        .ok_or_else(|| invalid(format!("draft not found: {id}")))
}

/// A draft with its content.
pub async fn draft(pool: &SqlitePool, id: &str) -> AppResult<Draft> {
    let row = queries::draft(pool, id)
        .await?
        .ok_or_else(|| invalid(format!("draft not found: {id}")))?;
    Ok(Draft {
        id: row.id,
        chapter_id: row.chapter_id,
        name: row.name,
        content: row.content,
        word_count: count(row.word_count),
        updated_at: row.updated_at,
    })
}

/// Adds a draft at the end of the chapter's: empty, or a copy of the draft
/// `copy_of` (of the same chapter). The current draft does not change.
pub async fn create_draft(
    pool: &SqlitePool,
    chapter_id: &str,
    name: &str,
    copy_of: Option<&str>,
) -> AppResult<Chapter> {
    let mut tx = db::begin_write(pool).await?;
    chapter_row(&mut tx, chapter_id).await?;
    let (content_json, notes, cues) = match copy_of {
        Some(source) => {
            let source = draft_row(&mut tx, source).await?;
            if source.chapter_id != chapter_id {
                return Err(invalid("a draft is copied within its chapter"));
            }
            // The copy has its own notes and sounds: new ids, in the text as
            // in the tables.
            let notes = queries::draft_notes(&mut *tx, &source.id).await?;
            let renamed: Vec<(String, String)> = notes
                .iter()
                .map(|note| (note.id.clone(), Uuid::new_v4().to_string()))
                .collect();
            let cues = queries::draft_cues(&mut *tx, &source.id).await?;
            let renamed_cues: Vec<(String, String)> = cues
                .iter()
                .map(|cue| (cue.id.clone(), Uuid::new_v4().to_string()))
                .collect();
            let content = rename_marks(&source.content, NOTE_MARK, "noteId", &renamed)?;
            let content = rename_marks(&content, CUE_MARK, CUE_ATTR, &renamed_cues)?;
            (
                content,
                notes.into_iter().zip(renamed).collect::<Vec<_>>(),
                cues.into_iter().zip(renamed_cues).collect::<Vec<_>>(),
            )
        }
        None => (EMPTY_DRAFT.to_owned(), Vec::new(), Vec::new()),
    };
    let order = i64::try_from(queries::chapter_drafts(&mut *tx, chapter_id).await?.len())
        .unwrap_or(i64::MAX);
    let draft_id = insert_draft(&mut tx, chapter_id, name, &content_json, order).await?;
    for (note, (_, new_id)) in notes {
        queries::insert_note(
            &mut *tx,
            &NoteRow {
                id: new_id,
                draft_id: draft_id.clone(),
                ..note
            },
        )
        .await?;
    }
    for (cue, (_, new_id)) in cues {
        queries::insert_cue(
            &mut *tx,
            &db::quill::CueRow {
                id: new_id,
                draft_id: draft_id.clone(),
                ..cue
            },
        )
        .await?;
    }
    queries::touch_chapter(&mut *tx, chapter_id, &now()).await?;
    tx.commit().await?;
    chapter(pool, chapter_id).await
}

pub async fn rename_draft(pool: &SqlitePool, id: &str, name: &str) -> AppResult<Chapter> {
    let row = queries::draft(pool, id)
        .await?
        .ok_or_else(|| invalid(format!("draft not found: {id}")))?;
    queries::rename_draft(pool, id, &validate_title(name)?, &now()).await?;
    chapter(pool, &row.chapter_id).await
}

/// Makes `draft_id` the chapter's current draft: its words count and its
/// mentions become the chapter's links.
pub async fn set_current_draft(pool: &SqlitePool, draft_id: &str) -> AppResult<Chapter> {
    let mut tx = db::begin_write(pool).await?;
    let row = draft_row(&mut tx, draft_id).await?;
    queries::set_current_draft(&mut *tx, &row.chapter_id, draft_id, &now()).await?;
    refresh_links(&mut tx, &row.chapter_id, &row.content).await?;
    tx.commit().await?;
    chapter(pool, &row.chapter_id).await
}

/// Deletes a draft for good, with its notes. A chapter keeps at least one
/// draft; when the current one goes, the first other becomes current.
pub async fn delete_draft(pool: &SqlitePool, id: &str) -> AppResult<Chapter> {
    let mut tx = db::begin_write(pool).await?;
    let row = draft_row(&mut tx, id).await?;
    let chapter_row = chapter_row(&mut tx, &row.chapter_id).await?;
    let others: Vec<DraftInfoRow> = queries::chapter_drafts(&mut *tx, &row.chapter_id)
        .await?
        .into_iter()
        .filter(|draft| draft.id != id)
        .collect();
    let Some(next) = others.first() else {
        return Err(invalid("a chapter keeps at least one draft"));
    };
    queries::delete_draft(&mut *tx, id).await?;
    if chapter_row.current_draft_id.as_deref() == Some(id) {
        let next = draft_row(&mut tx, &next.id).await?;
        queries::set_current_draft(&mut *tx, &row.chapter_id, &next.id, &now()).await?;
        refresh_links(&mut tx, &row.chapter_id, &next.content).await?;
    }
    tx.commit().await?;
    chapter(pool, &row.chapter_id).await
}

/// Saves a draft's content: its text and words are derived here, and when it
/// is the current draft, the chapter's links follow its mentions.
pub async fn save_draft(pool: &SqlitePool, id: &str, content_json: &str) -> AppResult<DraftInfo> {
    let (text, words, mentioned) = read_draft(content_json)?;
    let mut tx = db::begin_write(pool).await?;
    let row = draft_row(&mut tx, id).await?;
    let chapter = chapter_row(&mut tx, &row.chapter_id).await?;
    let now = now();
    queries::save_draft(&mut *tx, id, content_json, &text, words, &now).await?;
    if chapter.current_draft_id.as_deref() == Some(id) {
        links::replace_in(&mut tx, &chapter.id, LinkKind::Mention, None, &mentioned).await?;
    }
    queries::touch_chapter(&mut *tx, &chapter.id, &now).await?;
    queries::touch_story(&mut *tx, &chapter.story_id, &now).await?;
    tx.commit().await?;
    Ok(DraftInfo {
        id: id.to_owned(),
        name: row.name,
        word_count: count(words),
        updated_at: now,
    })
}

/// A note on a passage of a draft.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub id: String,
    pub draft_id: String,
    pub body: String,
    pub created_at: String,
    pub updated_at: String,
}

/// A note of a story, with its draft and chapter (the list of notes).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct StoryNote {
    pub id: String,
    pub draft_id: String,
    pub draft_name: String,
    pub chapter_id: String,
    pub chapter_title: String,
    pub body: String,
    pub created_at: String,
    pub updated_at: String,
}

fn note_of(row: NoteRow) -> Note {
    Note {
        id: row.id,
        draft_id: row.draft_id,
        body: row.body,
        created_at: row.created_at,
        updated_at: row.updated_at,
    }
}

fn check_note(body: &str) -> AppResult<()> {
    if body.chars().count() > MAX_NOTE_CHARS {
        return Err(invalid(format!(
            "a note holds at most {MAX_NOTE_CHARS} characters"
        )));
    }
    Ok(())
}

/// `content` with the ids held by the `attr` of its `mark` marks changed as
/// `renamed` (old, new) says: notes and sounds of a copied draft.
fn rename_marks(
    content: &str,
    mark: &str,
    attr: &str,
    renamed: &[(String, String)],
) -> AppResult<String> {
    if renamed.is_empty() {
        return Ok(content.to_owned());
    }
    let mut doc: Value =
        serde_json::from_str(content).map_err(|error| invalid(format!("draft: {error}")))?;
    let pointer = format!("/attrs/{attr}");
    fn walk(node: &mut Value, kind: &str, pointer: &str, renamed: &[(String, String)]) {
        if let Some(marks) = node.get_mut("marks").and_then(Value::as_array_mut) {
            for mark in marks {
                if mark.get("type").and_then(Value::as_str) == Some(kind)
                    && let Some(id) = mark.pointer_mut(pointer)
                    && let Some((_, new)) = renamed
                        .iter()
                        .find(|(old, _)| Some(old.as_str()) == id.as_str())
                {
                    *id = Value::String(new.clone());
                }
            }
        }
        if let Some(children) = node.get_mut("content").and_then(Value::as_array_mut) {
            for child in children {
                walk(child, kind, pointer, renamed);
            }
        }
    }
    walk(&mut doc, mark, &pointer, renamed);
    serde_json::to_string(&doc).map_err(|error| AppError::Internal(error.to_string()))
}

/// Adds a note to a draft (its mark is put on the passage by the front).
pub async fn create_note(pool: &SqlitePool, draft_id: &str, body: &str) -> AppResult<Note> {
    check_note(body)?;
    let mut tx = db::begin_write(pool).await?;
    draft_row(&mut tx, draft_id).await?;
    let now = now();
    let row = NoteRow {
        id: Uuid::new_v4().to_string(),
        draft_id: draft_id.to_owned(),
        body: body.to_owned(),
        created_at: now.clone(),
        updated_at: now,
    };
    queries::insert_note(&mut *tx, &row).await?;
    tx.commit().await?;
    Ok(note_of(row))
}

pub async fn update_note(pool: &SqlitePool, id: &str, body: &str) -> AppResult<Note> {
    check_note(body)?;
    if !queries::update_note(pool, id, body, &now()).await? {
        return Err(invalid(format!("note not found: {id}")));
    }
    let row = queries::note(pool, id)
        .await?
        .ok_or_else(|| invalid(format!("note not found: {id}")))?;
    Ok(note_of(row))
}

pub async fn delete_note(pool: &SqlitePool, id: &str) -> AppResult<()> {
    if !queries::delete_note(pool, id).await? {
        return Err(invalid(format!("note not found: {id}")));
    }
    Ok(())
}

/// The notes of a story, by chapter, then draft, then creation.
pub async fn story_notes(pool: &SqlitePool, story_id: &str) -> AppResult<Vec<StoryNote>> {
    Ok(queries::story_notes(pool, story_id)
        .await?
        .into_iter()
        .map(|row| StoryNote {
            id: row.id,
            draft_id: row.draft_id,
            draft_name: row.draft_name,
            chapter_id: row.chapter_id,
            chapter_title: row.chapter_title,
            body: row.body,
            created_at: row.created_at,
            updated_at: row.updated_at,
        })
        .collect())
}

/// A story's world panel layout (a JSON object read by the front; `{}` when
/// never saved).
pub async fn panel(pool: &SqlitePool, story_id: &str) -> AppResult<String> {
    if queries::story(pool, story_id).await?.is_none() {
        return Err(invalid(format!("story not found: {story_id}")));
    }
    Ok(queries::panel(pool, story_id)
        .await?
        .unwrap_or_else(|| "{}".to_owned()))
}

/// Keeps a story's world panel layout: a JSON object, bounded.
pub async fn save_panel(pool: &SqlitePool, story_id: &str, layout: &str) -> AppResult<()> {
    if layout.len() > MAX_PANEL_BYTES {
        return Err(invalid(format!(
            "a panel layout holds at most {MAX_PANEL_BYTES} bytes"
        )));
    }
    let value: Value =
        serde_json::from_str(layout).map_err(|error| invalid(format!("panel layout: {error}")))?;
    if !value.is_object() {
        return Err(invalid("a panel layout is an object"));
    }
    if queries::story(pool, story_id).await?.is_none() {
        return Err(invalid(format!("story not found: {story_id}")));
    }
    queries::save_panel(pool, story_id, layout).await
}

#[cfg(test)]
mod tests;
