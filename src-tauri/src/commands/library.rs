//! The library shared by the worlds (ADR 0006): images kept outside any
//! world, copied into the open world when picked.

use std::path::Path;

use tauri::State;

use crate::domain::media::{Asset, AssetFilter, ImportedAsset};
use crate::error::{AppError, AppResult};
use crate::state::AppState;

/// Assets of the library, newest first.
#[tauri::command]
#[specta::specta]
pub async fn list_library_assets(
    state: State<'_, AppState>,
    filter: AssetFilter,
) -> AppResult<Vec<Asset>> {
    state.library().await?.list(&filter).await
}

/// Copies a file of the PC into the library.
#[tauri::command]
#[specta::specta]
pub async fn import_library_asset(
    state: State<'_, AppState>,
    path: String,
) -> AppResult<ImportedAsset> {
    state.library().await?.import(Path::new(&path)).await
}

/// Copies assets of the open world into the library, with their names.
#[tauri::command]
#[specta::specta]
pub async fn add_assets_to_library(
    state: State<'_, AppState>,
    ids: Vec<String>,
) -> AppResult<Vec<ImportedAsset>> {
    let (pool, assets_dir) = {
        let guard = state.world.lock().await;
        let world = guard
            .as_ref()
            .ok_or_else(|| AppError::NoWorldOpen("add_assets_to_library".into()))?;
        (world.pool.clone(), world.assets_dir())
    };
    let library = state.library().await?;
    let mut added = Vec::with_capacity(ids.len());
    for id in &ids {
        let name = crate::db::assets::get(&pool, id)
            .await?
            .ok_or_else(|| AppError::InvalidInput(format!("asset not found: {id}")))?
            .name;
        added.push(library.add_from_world(&assets_dir, id, &name).await?);
    }
    Ok(added)
}

/// Changes the name of a library asset (the worlds' copies keep theirs).
#[tauri::command]
#[specta::specta]
pub async fn rename_library_asset(
    state: State<'_, AppState>,
    id: String,
    name: String,
) -> AppResult<Asset> {
    state.library().await?.rename(&id, &name).await
}

/// Removes an asset from the library; the worlds keep their copies.
#[tauri::command]
#[specta::specta]
pub async fn remove_library_asset(state: State<'_, AppState>, id: String) -> AppResult<()> {
    state.library().await?.remove(&id).await
}

/// Copies a library asset into the open world, which then uses it like its
/// other assets. Returns the world's asset.
#[tauri::command]
#[specta::specta]
pub async fn pick_library_asset(
    state: State<'_, AppState>,
    id: String,
) -> AppResult<ImportedAsset> {
    let (pool, assets_dir) = {
        let guard = state.world.lock().await;
        let world = guard
            .as_ref()
            .ok_or_else(|| AppError::NoWorldOpen("pick_library_asset".into()))?;
        (world.pool.clone(), world.assets_dir())
    };
    state
        .library()
        .await?
        .copy_into_world(&id, &pool, &assets_dir)
        .await
}
