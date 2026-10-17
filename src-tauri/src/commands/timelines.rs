//! Commands of the world's timelines (M11, ADR 0011).

use sqlx::SqlitePool;
use tauri::State;

use crate::domain::timelines::{self, Timeline, TimelineItem};
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

/// Creates a timeline with its first track (names translated by the front).
#[tauri::command]
#[specta::specta]
pub async fn create_timeline(
    state: State<'_, AppState>,
    title: String,
    track_name: String,
) -> AppResult<Timeline> {
    timelines::create(&pool(&state, "create_timeline").await?, &title, &track_name).await
}

#[tauri::command]
#[specta::specta]
pub async fn get_timeline(state: State<'_, AppState>, id: String) -> AppResult<Timeline> {
    timelines::get(&pool(&state, "get_timeline").await?, &id).await
}

#[tauri::command]
#[specta::specta]
pub async fn add_timeline_track(
    state: State<'_, AppState>,
    timeline_id: String,
    name: String,
    color: String,
) -> AppResult<Timeline> {
    timelines::add_track(
        &pool(&state, "add_timeline_track").await?,
        &timeline_id,
        &name,
        &color,
    )
    .await
}

#[tauri::command]
#[specta::specta]
pub async fn update_timeline_track(
    state: State<'_, AppState>,
    id: String,
    name: String,
    color: String,
) -> AppResult<Timeline> {
    timelines::update_track(
        &pool(&state, "update_timeline_track").await?,
        &id,
        &name,
        &color,
    )
    .await
}

#[tauri::command]
#[specta::specta]
pub async fn move_timeline_track(
    state: State<'_, AppState>,
    id: String,
    index: u32,
) -> AppResult<Timeline> {
    timelines::move_track(&pool(&state, "move_timeline_track").await?, &id, index).await
}

#[tauri::command]
#[specta::specta]
pub async fn delete_timeline_track(state: State<'_, AppState>, id: String) -> AppResult<Timeline> {
    timelines::delete_track(&pool(&state, "delete_timeline_track").await?, &id).await
}

/// Adds an item (a new id) or changes it.
#[tauri::command]
#[specta::specta]
pub async fn save_timeline_item(
    state: State<'_, AppState>,
    item: TimelineItem,
) -> AppResult<Timeline> {
    timelines::save_item(&pool(&state, "save_timeline_item").await?, &item).await
}

#[tauri::command]
#[specta::specta]
pub async fn delete_timeline_item(state: State<'_, AppState>, id: String) -> AppResult<Timeline> {
    timelines::delete_item(&pool(&state, "delete_timeline_item").await?, &id).await
}

/// Duplicates a timeline as `title` (translated by the front), right after it.
#[tauri::command]
#[specta::specta]
pub async fn duplicate_timeline(
    state: State<'_, AppState>,
    id: String,
    title: String,
) -> AppResult<Timeline> {
    timelines::duplicate(&pool(&state, "duplicate_timeline").await?, &id, &title).await
}
