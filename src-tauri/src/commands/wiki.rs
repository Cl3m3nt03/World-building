//! Commands of the wiki (M8).

use sqlx::SqlitePool;
use tauri::State;

use std::path::Path;

use crate::domain::wiki::{self, WikiPage, WikiSettings};
use crate::domain::wiki_export::{self, SiteFile};
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

/// Starts an export of the wiki: creates the site's folder, named after the
/// wiki, in `parent` (a folder chosen by the user). Returns its path.
#[tauri::command]
#[specta::specta]
pub async fn start_wiki_export(
    state: State<'_, AppState>,
    parent: String,
    title: String,
) -> AppResult<String> {
    let dir = wiki_export::site_dir(Path::new(&parent), &title)?;
    std::fs::create_dir_all(&dir)?;
    let shown = dir.to_string_lossy().into_owned();
    *state.wiki_export.lock().await = Some(dir);
    Ok(shown)
}

async fn export_dir(state: &AppState, command: &str) -> AppResult<std::path::PathBuf> {
    state
        .wiki_export
        .lock()
        .await
        .clone()
        .ok_or_else(|| AppError::InvalidInput(format!("{command}: no wiki export started")))
}

/// Writes a batch of the site's text files (pages, styles, scripts).
#[tauri::command]
#[specta::specta]
pub async fn write_wiki_export(state: State<'_, AppState>, files: Vec<SiteFile>) -> AppResult<()> {
    let dir = export_dir(&state, "write_wiki_export").await?;
    tokio::task::spawn_blocking(move || wiki_export::write_files(&dir, &files))
        .await
        .map_err(|error| AppError::Internal(format!("export task failed: {error}")))?
}

/// Copies a batch of the world's images into the site. Returns how many were
/// copied (an image deleted meanwhile is skipped).
#[tauri::command]
#[specta::specta]
pub async fn copy_wiki_export_assets(
    state: State<'_, AppState>,
    ids: Vec<String>,
) -> AppResult<u32> {
    let dir = export_dir(&state, "copy_wiki_export_assets").await?;
    let world_assets = state
        .world
        .lock()
        .await
        .as_ref()
        .map(|world| world.assets_dir())
        .ok_or_else(|| AppError::NoWorldOpen("copy_wiki_export_assets".into()))?;
    tokio::task::spawn_blocking(move || wiki_export::copy_assets(&world_assets, &dir, &ids))
        .await
        .map_err(|error| AppError::Internal(format!("export task failed: {error}")))?
}
