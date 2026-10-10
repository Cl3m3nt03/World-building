//! Queries of Quill: stories, chapters, drafts (migration 0018).

use sqlx::{SqliteExecutor, SqlitePool};

use crate::error::AppResult;

pub struct StoryRow {
    pub id: String,
    pub title: String,
    pub book_style: String,
    pub cover: String,
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,
}

/// A story with its counts: chapters, and words of their current drafts.
pub struct StoryListRow {
    pub id: String,
    pub title: String,
    pub book_style: String,
    pub cover: String,
    pub created_at: String,
    pub updated_at: String,
    pub chapter_count: i64,
    pub word_count: i64,
}

pub struct ChapterRow {
    pub id: String,
    pub story_id: String,
    pub title: String,
    pub sort_order: i64,
    pub current_draft_id: Option<String>,
    pub header_asset_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

pub struct DraftRow {
    pub id: String,
    pub chapter_id: String,
    pub name: String,
    pub content: String,
    pub content_text: String,
    pub word_count: i64,
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,
}

/// A draft without its content (lists).
pub struct DraftInfoRow {
    pub id: String,
    pub chapter_id: String,
    pub name: String,
    pub word_count: i64,
    pub updated_at: String,
}

// Stories.

pub async fn insert_story(ex: impl SqliteExecutor<'_>, row: &StoryRow) -> AppResult<()> {
    sqlx::query!(
        "INSERT INTO stories (id, title, book_style, cover, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
        row.id,
        row.title,
        row.book_style,
        row.cover,
        row.sort_order,
        row.created_at,
        row.updated_at
    )
    .execute(ex)
    .await?;
    Ok(())
}

pub async fn stories(pool: &SqlitePool) -> AppResult<Vec<StoryListRow>> {
    Ok(sqlx::query_as!(
        StoryListRow,
        r#"SELECT s.id AS "id!", s.title, s.book_style, s.cover, s.created_at, s.updated_at,
                  (SELECT COUNT(*) FROM chapters c WHERE c.story_id = s.id) AS "chapter_count!: i64",
                  (SELECT COALESCE(SUM(d.word_count), 0) FROM chapters c
                     JOIN drafts d ON d.id = c.current_draft_id
                     WHERE c.story_id = s.id) AS "word_count!: i64"
           FROM stories s ORDER BY s.sort_order, s.created_at"#
    )
    .fetch_all(pool)
    .await?)
}

pub async fn story(ex: impl SqliteExecutor<'_>, id: &str) -> AppResult<Option<StoryListRow>> {
    Ok(sqlx::query_as!(
        StoryListRow,
        r#"SELECT s.id AS "id!", s.title, s.book_style, s.cover, s.created_at, s.updated_at,
                  (SELECT COUNT(*) FROM chapters c WHERE c.story_id = s.id) AS "chapter_count!: i64",
                  (SELECT COALESCE(SUM(d.word_count), 0) FROM chapters c
                     JOIN drafts d ON d.id = c.current_draft_id
                     WHERE c.story_id = s.id) AS "word_count!: i64"
           FROM stories s WHERE s.id = ?"#,
        id
    )
    .fetch_optional(ex)
    .await?)
}

pub async fn story_count(ex: impl SqliteExecutor<'_>) -> AppResult<i64> {
    Ok(
        sqlx::query_scalar!(r#"SELECT COUNT(*) AS "count!: i64" FROM stories"#)
            .fetch_one(ex)
            .await?,
    )
}

/// Replaces a story's title, book style and cover; false when there is none.
pub async fn update_story(
    ex: impl SqliteExecutor<'_>,
    id: &str,
    title: &str,
    book_style: &str,
    cover: &str,
    updated_at: &str,
) -> AppResult<bool> {
    let done = sqlx::query!(
        "UPDATE stories SET title = ?, book_style = ?, cover = ?, updated_at = ? WHERE id = ?",
        title,
        book_style,
        cover,
        updated_at,
        id
    )
    .execute(ex)
    .await?;
    Ok(done.rows_affected() > 0)
}

pub async fn touch_story(ex: impl SqliteExecutor<'_>, id: &str, now: &str) -> AppResult<()> {
    sqlx::query!("UPDATE stories SET updated_at = ? WHERE id = ?", now, id)
        .execute(ex)
        .await?;
    Ok(())
}

/// Deletes a story, its chapters, drafts and notes; false when there is none.
pub async fn delete_story(ex: impl SqliteExecutor<'_>, id: &str) -> AppResult<bool> {
    let done = sqlx::query!("DELETE FROM stories WHERE id = ?", id)
        .execute(ex)
        .await?;
    Ok(done.rows_affected() > 0)
}

// Chapters.

pub async fn insert_chapter(ex: impl SqliteExecutor<'_>, row: &ChapterRow) -> AppResult<()> {
    sqlx::query!(
        "INSERT INTO chapters (id, story_id, title, sort_order, current_draft_id,
                               header_asset_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        row.id,
        row.story_id,
        row.title,
        row.sort_order,
        row.current_draft_id,
        row.header_asset_id,
        row.created_at,
        row.updated_at
    )
    .execute(ex)
    .await?;
    Ok(())
}

pub async fn chapters(ex: impl SqliteExecutor<'_>, story_id: &str) -> AppResult<Vec<ChapterRow>> {
    Ok(sqlx::query_as!(
        ChapterRow,
        r#"SELECT id AS "id!", story_id, title, sort_order, current_draft_id, header_asset_id,
                  created_at, updated_at
           FROM chapters WHERE story_id = ? ORDER BY sort_order, created_at"#,
        story_id
    )
    .fetch_all(ex)
    .await?)
}

pub async fn chapter(ex: impl SqliteExecutor<'_>, id: &str) -> AppResult<Option<ChapterRow>> {
    Ok(sqlx::query_as!(
        ChapterRow,
        r#"SELECT id AS "id!", story_id, title, sort_order, current_draft_id, header_asset_id,
                  created_at, updated_at
           FROM chapters WHERE id = ?"#,
        id
    )
    .fetch_optional(ex)
    .await?)
}

pub async fn set_chapter_order(ex: impl SqliteExecutor<'_>, id: &str, order: i64) -> AppResult<()> {
    sqlx::query!("UPDATE chapters SET sort_order = ? WHERE id = ?", order, id)
        .execute(ex)
        .await?;
    Ok(())
}

pub async fn rename_chapter(
    ex: impl SqliteExecutor<'_>,
    id: &str,
    title: &str,
    now: &str,
) -> AppResult<bool> {
    let done = sqlx::query!(
        "UPDATE chapters SET title = ?, updated_at = ? WHERE id = ?",
        title,
        now,
        id
    )
    .execute(ex)
    .await?;
    Ok(done.rows_affected() > 0)
}

pub async fn set_header(
    ex: impl SqliteExecutor<'_>,
    id: &str,
    asset_id: Option<&str>,
    now: &str,
) -> AppResult<bool> {
    let done = sqlx::query!(
        "UPDATE chapters SET header_asset_id = ?, updated_at = ? WHERE id = ?",
        asset_id,
        now,
        id
    )
    .execute(ex)
    .await?;
    Ok(done.rows_affected() > 0)
}

pub async fn set_current_draft(
    ex: impl SqliteExecutor<'_>,
    chapter_id: &str,
    draft_id: &str,
    now: &str,
) -> AppResult<()> {
    sqlx::query!(
        "UPDATE chapters SET current_draft_id = ?, updated_at = ? WHERE id = ?",
        draft_id,
        now,
        chapter_id
    )
    .execute(ex)
    .await?;
    Ok(())
}

pub async fn touch_chapter(ex: impl SqliteExecutor<'_>, id: &str, now: &str) -> AppResult<()> {
    sqlx::query!("UPDATE chapters SET updated_at = ? WHERE id = ?", now, id)
        .execute(ex)
        .await?;
    Ok(())
}

pub async fn delete_chapter(ex: impl SqliteExecutor<'_>, id: &str) -> AppResult<()> {
    sqlx::query!("DELETE FROM chapters WHERE id = ?", id)
        .execute(ex)
        .await?;
    Ok(())
}

// Drafts.

pub async fn insert_draft(ex: impl SqliteExecutor<'_>, row: &DraftRow) -> AppResult<()> {
    sqlx::query!(
        "INSERT INTO drafts (id, chapter_id, name, content, content_text, word_count,
                             sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        row.id,
        row.chapter_id,
        row.name,
        row.content,
        row.content_text,
        row.word_count,
        row.sort_order,
        row.created_at,
        row.updated_at
    )
    .execute(ex)
    .await?;
    Ok(())
}

/// The drafts of every chapter of a story, by chapter then in their order.
pub async fn story_drafts(
    ex: impl SqliteExecutor<'_>,
    story_id: &str,
) -> AppResult<Vec<DraftInfoRow>> {
    Ok(sqlx::query_as!(
        DraftInfoRow,
        r#"SELECT d.id AS "id!", d.chapter_id, d.name, d.word_count, d.updated_at
           FROM drafts d JOIN chapters c ON c.id = d.chapter_id
           WHERE c.story_id = ? ORDER BY d.chapter_id, d.sort_order, d.created_at"#,
        story_id
    )
    .fetch_all(ex)
    .await?)
}

pub async fn chapter_drafts(
    ex: impl SqliteExecutor<'_>,
    chapter_id: &str,
) -> AppResult<Vec<DraftInfoRow>> {
    Ok(sqlx::query_as!(
        DraftInfoRow,
        r#"SELECT id AS "id!", chapter_id, name, word_count, updated_at
           FROM drafts WHERE chapter_id = ? ORDER BY sort_order, created_at"#,
        chapter_id
    )
    .fetch_all(ex)
    .await?)
}

pub async fn draft(ex: impl SqliteExecutor<'_>, id: &str) -> AppResult<Option<DraftRow>> {
    Ok(sqlx::query_as!(
        DraftRow,
        r#"SELECT id AS "id!", chapter_id, name, content, content_text, word_count, sort_order,
                  created_at, updated_at
           FROM drafts WHERE id = ?"#,
        id
    )
    .fetch_optional(ex)
    .await?)
}

pub async fn save_draft(
    ex: impl SqliteExecutor<'_>,
    id: &str,
    content: &str,
    content_text: &str,
    word_count: i64,
    now: &str,
) -> AppResult<()> {
    sqlx::query!(
        "UPDATE drafts SET content = ?, content_text = ?, word_count = ?, updated_at = ?
         WHERE id = ?",
        content,
        content_text,
        word_count,
        now,
        id
    )
    .execute(ex)
    .await?;
    Ok(())
}

pub async fn rename_draft(
    ex: impl SqliteExecutor<'_>,
    id: &str,
    name: &str,
    now: &str,
) -> AppResult<bool> {
    let done = sqlx::query!(
        "UPDATE drafts SET name = ?, updated_at = ? WHERE id = ?",
        name,
        now,
        id
    )
    .execute(ex)
    .await?;
    Ok(done.rows_affected() > 0)
}

pub async fn delete_draft(ex: impl SqliteExecutor<'_>, id: &str) -> AppResult<()> {
    sqlx::query!("DELETE FROM drafts WHERE id = ?", id)
        .execute(ex)
        .await?;
    Ok(())
}

/// A story or a chapter using an image (the media library's "used by").
pub struct QuillUserRow {
    pub id: String,
    pub title: String,
    pub story_title: String,
}

/// The stories whose cover is the asset.
pub async fn covers_using(pool: &SqlitePool, asset_id: &str) -> AppResult<Vec<QuillUserRow>> {
    Ok(sqlx::query_as!(
        QuillUserRow,
        r#"SELECT id AS "id!", title, title AS "story_title!"
           FROM stories WHERE json_extract(cover, '$.assetId') = ?
           ORDER BY title COLLATE NOCASE"#,
        asset_id
    )
    .fetch_all(pool)
    .await?)
}

/// The chapters whose header is the asset.
pub async fn headers_using(pool: &SqlitePool, asset_id: &str) -> AppResult<Vec<QuillUserRow>> {
    Ok(sqlx::query_as!(
        QuillUserRow,
        r#"SELECT c.id AS "id!", c.title, s.title AS story_title
           FROM chapters c JOIN stories s ON s.id = c.story_id
           WHERE c.header_asset_id = ?
           ORDER BY s.title COLLATE NOCASE, c.sort_order"#,
        asset_id
    )
    .fetch_all(pool)
    .await?)
}

// Notes.

pub struct NoteRow {
    pub id: String,
    pub draft_id: String,
    pub body: String,
    pub created_at: String,
    pub updated_at: String,
}

/// A note with where it is: its draft and chapter.
pub struct StoryNoteRow {
    pub id: String,
    pub draft_id: String,
    pub draft_name: String,
    pub chapter_id: String,
    pub chapter_title: String,
    pub body: String,
    pub created_at: String,
    pub updated_at: String,
}

pub async fn insert_note(ex: impl SqliteExecutor<'_>, row: &NoteRow) -> AppResult<()> {
    sqlx::query!(
        "INSERT INTO chapter_notes (id, draft_id, body, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)",
        row.id,
        row.draft_id,
        row.body,
        row.created_at,
        row.updated_at
    )
    .execute(ex)
    .await?;
    Ok(())
}

pub async fn note(ex: impl SqliteExecutor<'_>, id: &str) -> AppResult<Option<NoteRow>> {
    Ok(sqlx::query_as!(
        NoteRow,
        r#"SELECT id AS "id!", draft_id, body, created_at, updated_at
           FROM chapter_notes WHERE id = ?"#,
        id
    )
    .fetch_optional(ex)
    .await?)
}

pub async fn draft_notes(ex: impl SqliteExecutor<'_>, draft_id: &str) -> AppResult<Vec<NoteRow>> {
    Ok(sqlx::query_as!(
        NoteRow,
        r#"SELECT id AS "id!", draft_id, body, created_at, updated_at
           FROM chapter_notes WHERE draft_id = ? ORDER BY created_at"#,
        draft_id
    )
    .fetch_all(ex)
    .await?)
}

/// The notes of a story, by chapter order, then draft order, then creation.
pub async fn story_notes(pool: &SqlitePool, story_id: &str) -> AppResult<Vec<StoryNoteRow>> {
    Ok(sqlx::query_as!(
        StoryNoteRow,
        r#"SELECT n.id AS "id!", n.draft_id, d.name AS draft_name, c.id AS "chapter_id!",
                  c.title AS chapter_title, n.body, n.created_at, n.updated_at
           FROM chapter_notes n
           JOIN drafts d ON d.id = n.draft_id
           JOIN chapters c ON c.id = d.chapter_id
           WHERE c.story_id = ?
           ORDER BY c.sort_order, d.sort_order, n.created_at"#,
        story_id
    )
    .fetch_all(pool)
    .await?)
}

pub async fn update_note(
    ex: impl SqliteExecutor<'_>,
    id: &str,
    body: &str,
    now: &str,
) -> AppResult<bool> {
    let done = sqlx::query!(
        "UPDATE chapter_notes SET body = ?, updated_at = ? WHERE id = ?",
        body,
        now,
        id
    )
    .execute(ex)
    .await?;
    Ok(done.rows_affected() > 0)
}

pub async fn delete_note(ex: impl SqliteExecutor<'_>, id: &str) -> AppResult<bool> {
    let done = sqlx::query!("DELETE FROM chapter_notes WHERE id = ?", id)
        .execute(ex)
        .await?;
    Ok(done.rows_affected() > 0)
}

// The world panel.

/// A story's world panel layout (JSON), if it was ever saved.
pub async fn panel(ex: impl SqliteExecutor<'_>, story_id: &str) -> AppResult<Option<String>> {
    Ok(sqlx::query_scalar!(
        "SELECT layout FROM writing_panel WHERE story_id = ?",
        story_id
    )
    .fetch_optional(ex)
    .await?)
}

pub async fn save_panel(
    ex: impl SqliteExecutor<'_>,
    story_id: &str,
    layout: &str,
) -> AppResult<()> {
    sqlx::query!(
        "INSERT INTO writing_panel (story_id, layout) VALUES (?, ?)
         ON CONFLICT (story_id) DO UPDATE SET layout = excluded.layout",
        story_id,
        layout
    )
    .execute(ex)
    .await?;
    Ok(())
}
