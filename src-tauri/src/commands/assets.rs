use std::path::{Path, PathBuf};

use sqlx::SqlitePool;
use tauri::State;

use crate::domain::media::{self, Asset, AssetFilter, ImportedAsset};
use crate::error::{AppError, AppResult};
use crate::state::AppState;

/// Pool and `assets/` folder of the open world, taken without holding the lock.
async fn open_world(state: &AppState, command: &str) -> AppResult<(SqlitePool, PathBuf)> {
    state
        .world
        .lock()
        .await
        .as_ref()
        .map(|world| (world.pool.clone(), world.assets_dir()))
        .ok_or_else(|| AppError::NoWorldOpen(command.into()))
}

/// Copies the file at `path` into the open world's media library, named by
/// its content hash. Importing the same content again returns the existing asset.
#[tauri::command]
#[specta::specta]
pub async fn import_asset(state: State<'_, AppState>, path: String) -> AppResult<ImportedAsset> {
    let (pool, assets_dir) = open_world(&state, "import_asset").await?;
    media::import(&pool, &assets_dir, Path::new(&path)).await
}

/// Assets of the open world, newest first.
#[tauri::command]
#[specta::specta]
pub async fn list_assets(state: State<'_, AppState>, filter: AssetFilter) -> AppResult<Vec<Asset>> {
    let (pool, _) = open_world(&state, "list_assets").await?;
    media::list(&pool, &filter).await
}

/// Changes the name shown for an asset (its file keeps its hash name).
#[tauri::command]
#[specta::specta]
pub async fn rename_asset(
    state: State<'_, AppState>,
    id: String,
    name: String,
) -> AppResult<Asset> {
    let (pool, _) = open_world(&state, "rename_asset").await?;
    media::rename(&pool, &id, &name).await
}

/// Deletes an asset and its file. If it was the world's main image, the
/// world no longer has one.
#[tauri::command]
#[specta::specta]
pub async fn delete_asset(state: State<'_, AppState>, id: String) -> AppResult<()> {
    let (pool, assets_dir) = open_world(&state, "delete_asset").await?;
    media::delete(&pool, &assets_dir, &id).await?;

    let mut guard = state.world.lock().await;
    if let Some(world) = guard.as_mut()
        && world.file.main_image.as_deref() == Some(id.as_str())
    {
        world.set_main_image(None)?;
    }
    Ok(())
}
