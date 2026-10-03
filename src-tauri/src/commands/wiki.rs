//! Commands of the wiki (M8).

use sqlx::SqlitePool;
use tauri::State;

use crate::domain::wiki::{self, WikiPage, WikiSettings};
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

/// The wiki's home page and style.
#[tauri::command]
#[specta::specta]
pub async fn wiki_settings(state: State<'_, AppState>) -> AppResult<WikiSettings> {
    wiki::settings(&pool(&state, "wiki_settings").await?).await
}

/// Replaces the wiki's settings.
#[tauri::command]
#[specta::specta]
pub async fn save_wiki_settings(
    state: State<'_, AppState>,
    settings: WikiSettings,
) -> AppResult<()> {
    wiki::save_settings(&pool(&state, "save_wiki_settings").await?, &settings).await
}

/// Marks a card or a map « Visible dans le wiki », or not.
#[tauri::command]
#[specta::specta]
pub async fn set_wiki_visible(
    state: State<'_, AppState>,
    id: String,
    visible: bool,
) -> AppResult<()> {
    wiki::set_visible(&pool(&state, "set_wiki_visible").await?, &id, visible).await
}

/// The wiki's pages: the cards and maps marked visible, by title.
#[tauri::command]
#[specta::specta]
pub async fn wiki_pages(state: State<'_, AppState>) -> AppResult<Vec<WikiPage>> {
    wiki::pages(&pool(&state, "wiki_pages").await?).await
}
