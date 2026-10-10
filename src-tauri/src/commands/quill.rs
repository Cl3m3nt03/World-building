//! Commands of Quill (M9, ADR 0009).

use sqlx::SqlitePool;
use tauri::State;

use crate::domain::quill::{
    self, Chapter, Draft, DraftInfo, NewStory, Note, Story, StoryNote, StoryOutline, StoryPatch,
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
