//! Commands of Quill (M9, ADR 0009).

use sqlx::SqlitePool;
use tauri::State;

use crate::domain::book::{self, ExportChapter, ExportFormat};
use crate::domain::quill::{
    self, AudioCue, Chapter, CueKind, CuePatch, Draft, DraftInfo, NewStory, Note, ReaderSettings,
    Story, StoryNote, StoryOutline, StoryPatch,
};
use crate::error::{AppError, AppResult};
use crate::state::AppState;

async fn pool(state: &AppState, command: &str) -> AppResult<SqlitePool> {
    state
        .world
        .lock()
        .await
        .as_ref()
        .map(|world| world.pool.clone())
        .ok_or_else(|| AppError::NoWorldOpen(command.into()))
}

/// The world's stories, in their order.
#[tauri::command]
#[specta::specta]
pub async fn list_stories(state: State<'_, AppState>) -> AppResult<Vec<Story>> {
    quill::list(&pool(&state, "list_stories").await?).await
}

/// A story and its chapters, with their drafts.
#[tauri::command]
#[specta::specta]
pub async fn story_outline(state: State<'_, AppState>, id: String) -> AppResult<StoryOutline> {
    quill::outline(&pool(&state, "story_outline").await?, &id).await
}

/// Creates a story with its first chapter and draft.
#[tauri::command]
#[specta::specta]
pub async fn create_story(state: State<'_, AppState>, story: NewStory) -> AppResult<StoryOutline> {
    quill::create(&pool(&state, "create_story").await?, &story).await
}

#[tauri::command]
#[specta::specta]
pub async fn update_story(
    state: State<'_, AppState>,
    id: String,
    patch: StoryPatch,
) -> AppResult<Story> {
    quill::update(&pool(&state, "update_story").await?, &id, &patch).await
}

/// Deletes a story for good, with all it holds.
#[tauri::command]
#[specta::specta]
pub async fn delete_story(state: State<'_, AppState>, id: String) -> AppResult<()> {
    quill::delete(&pool(&state, "delete_story").await?, &id).await
}

#[tauri::command]
#[specta::specta]
pub async fn create_chapter(
    state: State<'_, AppState>,
    story_id: String,
    title: String,
    draft_name: String,
) -> AppResult<Chapter> {
    quill::create_chapter(
        &pool(&state, "create_chapter").await?,
        &story_id,
        &title,
        &draft_name,
    )
    .await
}

#[tauri::command]
#[specta::specta]
pub async fn rename_chapter(
    state: State<'_, AppState>,
    id: String,
    title: String,
) -> AppResult<Chapter> {
    quill::rename_chapter(&pool(&state, "rename_chapter").await?, &id, &title).await
}

#[tauri::command]
#[specta::specta]
pub async fn set_chapter_header(
    state: State<'_, AppState>,
    id: String,
    asset_id: Option<String>,
) -> AppResult<Chapter> {
    quill::set_chapter_header(
        &pool(&state, "set_chapter_header").await?,
        &id,
        asset_id.as_deref(),
    )
    .await
}

#[tauri::command]
#[specta::specta]
pub async fn move_chapter(
    state: State<'_, AppState>,
    id: String,
    index: u32,
) -> AppResult<StoryOutline> {
    quill::move_chapter(&pool(&state, "move_chapter").await?, &id, index).await
}

#[tauri::command]
#[specta::specta]
pub async fn delete_chapter(state: State<'_, AppState>, id: String) -> AppResult<StoryOutline> {
    quill::delete_chapter(&pool(&state, "delete_chapter").await?, &id).await
}

/// A draft with its content.
#[tauri::command]
#[specta::specta]
pub async fn get_draft(state: State<'_, AppState>, id: String) -> AppResult<Draft> {
    quill::draft(&pool(&state, "get_draft").await?, &id).await
}

/// Adds a draft to a chapter: empty, or a copy of `copy_of`.
#[tauri::command]
#[specta::specta]
pub async fn create_draft(
    state: State<'_, AppState>,
    chapter_id: String,
    name: String,
    copy_of: Option<String>,
) -> AppResult<Chapter> {
    quill::create_draft(
        &pool(&state, "create_draft").await?,
        &chapter_id,
        &name,
        copy_of.as_deref(),
    )
    .await
}

#[tauri::command]
#[specta::specta]
pub async fn rename_draft(
    state: State<'_, AppState>,
    id: String,
    name: String,
) -> AppResult<Chapter> {
    quill::rename_draft(&pool(&state, "rename_draft").await?, &id, &name).await
}

#[tauri::command]
#[specta::specta]
pub async fn set_current_draft(state: State<'_, AppState>, id: String) -> AppResult<Chapter> {
    quill::set_current_draft(&pool(&state, "set_current_draft").await?, &id).await
}

#[tauri::command]
#[specta::specta]
pub async fn delete_draft(state: State<'_, AppState>, id: String) -> AppResult<Chapter> {
    quill::delete_draft(&pool(&state, "delete_draft").await?, &id).await
}

/// Saves a draft's content (a TipTap document as JSON).
#[tauri::command]
#[specta::specta]
pub async fn save_draft(
    state: State<'_, AppState>,
    id: String,
    content: String,
) -> AppResult<DraftInfo> {
    quill::save_draft(&pool(&state, "save_draft").await?, &id, &content).await
}

/// Adds a note to a draft.
#[tauri::command]
#[specta::specta]
pub async fn create_note(
    state: State<'_, AppState>,
    draft_id: String,
    body: String,
) -> AppResult<Note> {
    quill::create_note(&pool(&state, "create_note").await?, &draft_id, &body).await
}

#[tauri::command]
#[specta::specta]
pub async fn update_note(state: State<'_, AppState>, id: String, body: String) -> AppResult<Note> {
    quill::update_note(&pool(&state, "update_note").await?, &id, &body).await
}

#[tauri::command]
#[specta::specta]
pub async fn delete_note(state: State<'_, AppState>, id: String) -> AppResult<()> {
    quill::delete_note(&pool(&state, "delete_note").await?, &id).await
}

/// The notes of a story, by chapter.
#[tauri::command]
#[specta::specta]
pub async fn story_notes(
    state: State<'_, AppState>,
    story_id: String,
) -> AppResult<Vec<StoryNote>> {
    quill::story_notes(&pool(&state, "story_notes").await?, &story_id).await
}

/// A story's world panel layout (JSON).
#[tauri::command]
#[specta::specta]
pub async fn writing_panel(state: State<'_, AppState>, story_id: String) -> AppResult<String> {
    quill::panel(&pool(&state, "writing_panel").await?, &story_id).await
}

/// Keeps a story's world panel layout.
#[tauri::command]
#[specta::specta]
pub async fn save_writing_panel(
    state: State<'_, AppState>,
    story_id: String,
    layout: String,
) -> AppResult<()> {
    quill::save_panel(
        &pool(&state, "save_writing_panel").await?,
        &story_id,
        &layout,
    )
    .await
}

/// A story's reading settings (M10).
#[tauri::command]
#[specta::specta]
pub async fn reader_settings(
    state: State<'_, AppState>,
    story_id: String,
) -> AppResult<ReaderSettings> {
    quill::reader_settings(&pool(&state, "reader_settings").await?, &story_id).await
}

#[tauri::command]
#[specta::specta]
pub async fn save_reader_settings(
    state: State<'_, AppState>,
    story_id: String,
    settings: ReaderSettings,
) -> AppResult<ReaderSettings> {
    quill::save_reader_settings(
        &pool(&state, "save_reader_settings").await?,
        &story_id,
        &settings,
    )
    .await
}

/// The sounds of a draft (M10).
#[tauri::command]
#[specta::specta]
pub async fn draft_audio_cues(
    state: State<'_, AppState>,
    draft_id: String,
) -> AppResult<Vec<AudioCue>> {
    quill::draft_cues(&pool(&state, "draft_audio_cues").await?, &draft_id).await
}

/// Adds a sound to a draft; the front marks its passage.
#[tauri::command]
#[specta::specta]
pub async fn create_audio_cue(
    state: State<'_, AppState>,
    draft_id: String,
    kind: CueKind,
    asset_id: String,
) -> AppResult<AudioCue> {
    quill::create_cue(
        &pool(&state, "create_audio_cue").await?,
        &draft_id,
        kind,
        &asset_id,
    )
    .await
}

#[tauri::command]
#[specta::specta]
pub async fn update_audio_cue(
    state: State<'_, AppState>,
    id: String,
    patch: CuePatch,
) -> AppResult<AudioCue> {
    quill::update_cue(&pool(&state, "update_audio_cue").await?, &id, &patch).await
}

#[tauri::command]
#[specta::specta]
pub async fn delete_audio_cue(state: State<'_, AppState>, id: String) -> AppResult<()> {
    quill::delete_cue(&pool(&state, "delete_audio_cue").await?, &id).await
}

/// What an export asks for (M10): the chapters and their drafts, the format,
/// the file chosen, the app's language and the cover drawn by the front
/// (a PNG in base64).
#[derive(Debug, Clone, serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct StoryExport {
    pub story_id: String,
    pub chapters: Vec<ExportChapter>,
    pub format: ExportFormat,
    pub path: String,
    pub language: String,
    pub cover_png: Option<String>,
}

/// Exports a story to a file (ePub); returns the path written.
#[tauri::command]
#[specta::specta]
pub async fn export_story(state: State<'_, AppState>, request: StoryExport) -> AppResult<String> {
    use base64::Engine;
    let (pool, assets_dir) = state
        .world
        .lock()
        .await
        .as_ref()
        .map(|world| (world.pool.clone(), world.assets_dir()))
        .ok_or_else(|| AppError::NoWorldOpen("export_story".into()))?;
    let cover = match &request.cover_png {
        Some(data) => Some(
            base64::engine::general_purpose::STANDARD
                .decode(data)
                .map_err(|error| AppError::InvalidInput(format!("cover: {error}")))?,
        ),
        None => None,
    };
    let path = book::target(&request.path, request.format)?;
    let book = book::load(
        &pool,
        &assets_dir,
        &request.story_id,
        &request.chapters,
        &request.language,
        cover,
    )
    .await?;
    let format = request.format;
    let written = path.clone();
    tokio::task::spawn_blocking(move || book::write(&book, format, &written))
        .await
        .map_err(|error| AppError::Internal(format!("export task failed: {error}")))??;
    Ok(path.to_string_lossy().into_owned())
}
