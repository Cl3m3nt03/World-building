use std::path::Path;

use tauri::State;

use crate::error::{AppError, AppResult};
use crate::state::AppState;
use crate::world::assets::{self, AssetInfo};

/// Copies the file at `path` into the open world's `assets/`, named by its
/// content hash. Importing the same content again returns the existing asset.
#[tauri::command]
#[specta::specta]
pub async fn import_asset(state: State<'_, AppState>, path: String) -> AppResult<AssetInfo> {
    let assets_dir = state
        .world
        .lock()
        .await
        .as_ref()
        .map(|world| world.assets_dir())
        .ok_or_else(|| AppError::NoWorldOpen("import_asset".into()))?;

    let source = Path::new(&path).to_path_buf();
    tauri::async_runtime::spawn_blocking(move || assets::import(&assets_dir, &source))
        .await
        .map_err(|error| AppError::Internal(format!("import task failed: {error}")))?
}
