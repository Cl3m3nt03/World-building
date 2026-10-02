//! Maps (M4): create, read, save the content, change the background,
//! duplicate.

use std::path::PathBuf;

use sqlx::SqlitePool;
use tauri::State;

use crate::db;
use crate::domain::maps::{self, Map, MapContent};
use crate::error::{AppError, AppResult};
use crate::state::AppState;
use crate::world::{assets, tiles};

async fn pool(state: &AppState, command: &str) -> AppResult<SqlitePool> {
    Ok(world(state, command).await?.0)
}

/// Pool and folder of the open world.
async fn world(state: &AppState, command: &str) -> AppResult<(SqlitePool, PathBuf)> {
    state
        .world
        .lock()
        .await
        .as_ref()
        .map(|world| (world.pool.clone(), world.root().to_path_buf()))
        .ok_or_else(|| AppError::NoWorldOpen(command.into()))
}

/// Cuts the map's background into tiles when it is very large (4.3), or
/// removes its tiles when it no longer needs them. Returns the map as now.
async fn sync_tiles(pool: &SqlitePool, root: PathBuf, map: Map) -> AppResult<Map> {
    let dir = tiles::dir(&root, &map.id)?;
    let large = tiles::needs_tiles(map.width, map.height);
    match (&map.background_asset_id, large) {
        (Some(asset), true) => {
            let source = assets::resolve(&root.join(crate::world::ASSETS_DIR), asset)?;
            let dest = dir.clone();
            tokio::task::spawn_blocking(move || tiles::generate(&source, &dest))
                .await
                .map_err(|error| AppError::Internal(format!("tiling task failed: {error}")))??;
            let relative = format!("{}/{}", tiles::TILES_DIR, map.id);
            db::maps::set_tiles(pool, &map.id, Some(&relative)).await?;
        }
        _ => {
            if dir.exists() {
                std::fs::remove_dir_all(&dir)?;
            }
            db::maps::set_tiles(pool, &map.id, None).await?;
        }
    }
    maps::get(pool, &map.id).await
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
    let (pool, root) = world(&state, "create_map").await?;
    let map = maps::create(&pool, &title, &background_asset_id, &layer_name).await?;
    sync_tiles(&pool, root, map).await
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
    let (pool, root) = world(&state, "set_map_background").await?;
    let map = maps::set_background(&pool, &id, &asset_id).await?;
    sync_tiles(&pool, root, map).await
}

/// Duplicates a map as `title` (translated by the front), right after it.
#[tauri::command]
#[specta::specta]
pub async fn duplicate_map(
    state: State<'_, AppState>,
    id: String,
    title: String,
) -> AppResult<Map> {
    let (pool, root) = world(&state, "duplicate_map").await?;
    let map = maps::duplicate(&pool, &id, &title).await?;
    sync_tiles(&pool, root, map).await
}
