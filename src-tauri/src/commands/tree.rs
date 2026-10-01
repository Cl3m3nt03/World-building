use sqlx::SqlitePool;
use tauri::State;

use crate::domain::tree::{self, DocumentTree, Folder, FolderDeletion, FolderPatch, Place};
use crate::error::{AppError, AppResult};
use crate::state::AppState;

/// Pool of the open world, taken without holding the lock.
async fn pool(state: &AppState, command: &str) -> AppResult<SqlitePool> {
    state
        .world
        .lock()
        .await
        .as_ref()
        .map(|world| world.pool.clone())
        .ok_or_else(|| AppError::NoWorldOpen(command.into()))
}

/// The sidebar's folders and live documents, with their place and order.
#[tauri::command]
#[specta::specta]
pub async fn document_tree(state: State<'_, AppState>) -> AppResult<DocumentTree> {
    tree::tree(&pool(&state, "document_tree").await?).await
}

/// Moves a live document (with its children) to `index` of `place`. Refused
/// if it would go under itself or one of its descendants.
#[tauri::command]
#[specta::specta]
pub async fn move_document(
    state: State<'_, AppState>,
    id: String,
    place: Place,
    index: u32,
) -> AppResult<()> {
    let pool = pool(&state, "move_document").await?;
    tree::move_document(&pool, &id, &place, index as usize).await
}

/// Creates a folder at the end of `parentId` (the root when `null`).
#[tauri::command]
#[specta::specta]
pub async fn create_folder(
    state: State<'_, AppState>,
    parent_id: Option<String>,
    name: String,
    icon: String,
) -> AppResult<Folder> {
    let pool = pool(&state, "create_folder").await?;
    tree::create_folder(&pool, parent_id.as_deref(), &name, &icon).await
}

/// Renames a folder or changes its icon.
#[tauri::command]
#[specta::specta]
pub async fn update_folder(
    state: State<'_, AppState>,
    id: String,
    patch: FolderPatch,
) -> AppResult<Folder> {
    tree::update_folder(&pool(&state, "update_folder").await?, &id, &patch).await
}

/// Moves a folder (with its content) to `index` of `parentId` (the root when
/// `null`). Refused if it would go into itself or one of its subfolders.
#[tauri::command]
#[specta::specta]
pub async fn move_folder(
    state: State<'_, AppState>,
    id: String,
    parent_id: Option<String>,
    index: u32,
) -> AppResult<()> {
    let pool = pool(&state, "move_folder").await?;
    tree::move_folder(&pool, &id, parent_id.as_deref(), index as usize).await
}

/// Deletes a folder: its content takes its place (`lift`), or goes to the
/// trash (`trash`).
#[tauri::command]
#[specta::specta]
pub async fn delete_folder(
    state: State<'_, AppState>,
    id: String,
    mode: FolderDeletion,
) -> AppResult<()> {
    tree::delete_folder(&pool(&state, "delete_folder").await?, &id, mode).await
}
