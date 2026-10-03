//! Canvases (M7): create, read, save the scene, duplicate.

use sqlx::SqlitePool;
use tauri::State;

use crate::domain::canvases::{self, Canvas};
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

/// Creates an empty canvas named `title` (translated by the front).
#[tauri::command]
#[specta::specta]
pub async fn create_canvas(state: State<'_, AppState>, title: String) -> AppResult<Canvas> {
    canvases::create(&pool(&state, "create_canvas").await?, &title).await
}

#[tauri::command]
#[specta::specta]
pub async fn get_canvas(state: State<'_, AppState>, id: String) -> AppResult<Canvas> {
    canvases::get(&pool(&state, "get_canvas").await?, &id).await
}

/// Replaces the canvas's scene (`{ "elements": [...] }`, no image bytes) and
/// kept state, both JSON.
#[tauri::command]
#[specta::specta]
pub async fn save_canvas(
    state: State<'_, AppState>,
    id: String,
    scene: String,
    app_state: String,
) -> AppResult<()> {
    canvases::save(&pool(&state, "save_canvas").await?, &id, &scene, &app_state).await
}

/// Duplicates a canvas as `title` (translated by the front), right after it.
#[tauri::command]
#[specta::specta]
pub async fn duplicate_canvas(
    state: State<'_, AppState>,
    id: String,
    title: String,
) -> AppResult<Canvas> {
    canvases::duplicate(&pool(&state, "duplicate_canvas").await?, &id, &title).await
}
