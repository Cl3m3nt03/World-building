//! Maps (M4): create, read, save the content, change the background,
//! duplicate.

use sqlx::SqlitePool;
use tauri::State;

use crate::domain::maps::{self, Map, MapContent};
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

/// Creates a map on an image of the media library, with one layer named
/// `layer_name` (translated by the front).
#[tauri::command]
#[specta::specta]
pub async fn create_map(
    state: State<'_, AppState>,
    title: String,
    background_asset_id: String,
    layer_name: String,
) -> AppResult<Map> {
    let pool = pool(&state, "create_map").await?;
    maps::create(&pool, &title, &background_asset_id, &layer_name).await
}

#[tauri::command]
#[specta::specta]
pub async fn get_map(state: State<'_, AppState>, id: String) -> AppResult<Map> {
    let pool = pool(&state, "get_map").await?;
    maps::get(&pool, &id).await
}

/// Replaces the map's layers, pins, zones and texts with `content`.
#[tauri::command]
#[specta::specta]
pub async fn save_map(
    state: State<'_, AppState>,
    id: String,
    content: MapContent,
) -> AppResult<()> {
    let pool = pool(&state, "save_map").await?;
    maps::save(&pool, &id, &content).await
}

/// Puts another image under the map, keeping what is on it.
#[tauri::command]
#[specta::specta]
pub async fn set_map_background(
    state: State<'_, AppState>,
    id: String,
    asset_id: String,
) -> AppResult<Map> {
    let pool = pool(&state, "set_map_background").await?;
    maps::set_background(&pool, &id, &asset_id).await
}

/// Duplicates a map as `title` (translated by the front), right after it.
#[tauri::command]
#[specta::specta]
pub async fn duplicate_map(
    state: State<'_, AppState>,
    id: String,
    title: String,
) -> AppResult<Map> {
    let pool = pool(&state, "duplicate_map").await?;
    maps::duplicate(&pool, &id, &title).await
}
