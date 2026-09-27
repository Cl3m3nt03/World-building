use sqlx::SqlitePool;
use tauri::State;

use crate::domain::documents::{self, Document, DocumentFilter};
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

/// Documents of the open world, live or in the trash, by title.
#[tauri::command]
#[specta::specta]
pub async fn list_documents(
    state: State<'_, AppState>,
    filter: DocumentFilter,
) -> AppResult<Vec<Document>> {
    documents::list(&pool(&state, "list_documents").await?, &filter).await
}

#[tauri::command]
#[specta::specta]
pub async fn rename_document(
    state: State<'_, AppState>,
    id: String,
    title: String,
) -> AppResult<Document> {
    documents::rename(&pool(&state, "rename_document").await?, &id, &title).await
}

/// Puts a document in the world's trash, from where it can be restored.
#[tauri::command]
#[specta::specta]
pub async fn trash_document(state: State<'_, AppState>, id: String) -> AppResult<Document> {
    documents::trash(&pool(&state, "trash_document").await?, &id).await
}

#[tauri::command]
#[specta::specta]
pub async fn restore_document(state: State<'_, AppState>, id: String) -> AppResult<Document> {
    documents::restore(&pool(&state, "restore_document").await?, &id).await
}

/// Deletes a document of the trash for good.
#[tauri::command]
#[specta::specta]
pub async fn delete_document(state: State<'_, AppState>, id: String) -> AppResult<()> {
    documents::delete_forever(&pool(&state, "delete_document").await?, &id).await
}

/// Deletes everything in the trash for good. Returns how many documents.
#[tauri::command]
#[specta::specta]
pub async fn empty_trash(state: State<'_, AppState>) -> AppResult<u32> {
    let count = documents::empty_trash(&pool(&state, "empty_trash").await?).await?;
    Ok(u32::try_from(count).unwrap_or(u32::MAX))
}
