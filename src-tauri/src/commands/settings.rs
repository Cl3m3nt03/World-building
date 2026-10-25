use std::path::Path;

use tauri::State;

use crate::error::{AppError, AppResult};
use crate::settings::{self, AppSettings, Preferences, RecentWorld};
use crate::state::AppState;
use crate::world;

/// App settings: preferences and recent worlds.
#[tauri::command]
#[specta::specta]
pub async fn get_settings(state: State<'_, AppState>) -> AppResult<AppSettings> {
    Ok(state.settings.lock().await.clone())
}

/// Sets (absolute path) or resets (`null`) the folder proposed for new
/// worlds, and returns the updated settings.
#[tauri::command]
#[specta::specta]
pub async fn set_default_worlds_dir(
    state: State<'_, AppState>,
    path: Option<String>,
) -> AppResult<AppSettings> {
    let mut settings = state.settings.lock().await;
    let mut updated = settings.clone();
    updated.set_default_worlds_dir(path.as_deref())?;
    settings::save(&state.config_dir, &updated)?;
    *settings = updated.clone();
    Ok(updated)
}

/// Removes a world from the recent list. Its folder is not touched.
#[tauri::command]
#[specta::specta]
pub async fn remove_recent_world(
    state: State<'_, AppState>,
    path: String,
) -> AppResult<AppSettings> {
    let mut settings = state.settings.lock().await;
    let mut updated = settings.clone();
    updated.remove_recent_world(&path);
    settings::save(&state.config_dir, &updated)?;
    *settings = updated.clone();
    Ok(updated)
}

/// Pins a recent world at the top of the list, or unpins it (V2-2+.3).
#[tauri::command]
#[specta::specta]
pub async fn set_recent_world_pinned(
    state: State<'_, AppState>,
    path: String,
    pinned: bool,
) -> AppResult<AppSettings> {
    let mut settings = state.settings.lock().await;
    let mut updated = settings.clone();
    updated.set_recent_world_pinned(&path, pinned)?;
    settings::save(&state.config_dir, &updated)?;
    *settings = updated.clone();
    Ok(updated)
}

/// Duplicates the world in `path` (open or not) into a sibling folder
/// « Name (copie) » with a new id, and adds the copy to the recent worlds,
/// without opening it (V2-2+.3).
#[tauri::command]
#[specta::specta]
pub async fn duplicate_world(state: State<'_, AppState>, path: String) -> AppResult<AppSettings> {
    let (folder, file) = world::duplicate(Path::new(&path)).await?;
    let mut settings = state.settings.lock().await;
    let mut updated = settings.clone();
    updated.record_recent_world(RecentWorld {
        path: folder.to_string_lossy().into_owned(),
        name: file.name.clone(),
        id: Some(file.id.to_string()),
        genre: Some(file.genre),
        thumbnail: false,
        last_opened_at: file
            .last_opened_at
            .format(&time::format_description::well_known::Rfc3339)
            .unwrap_or_default(),
        pinned: false,
    });
    settings::save(&state.config_dir, &updated)?;
    *settings = updated.clone();
    Ok(updated)
}

/// Paths of the recent worlds whose folder no longer holds a world
/// (moved, renamed or deleted).
#[tauri::command]
#[specta::specta]
pub async fn missing_recent_worlds(state: State<'_, AppState>) -> AppResult<Vec<String>> {
    let settings = state.settings.lock().await;
    Ok(settings
        .recent_worlds
        .iter()
        .filter(|recent| !Path::new(&recent.path).join(world::WORLD_FILE).is_file())
        .map(|recent| recent.path.clone())
        .collect())
}

/// Points a recent world whose folder moved to `new_path`, after checking
/// that the world there is the same one (same id).
#[tauri::command]
#[specta::specta]
pub async fn relocate_recent_world(
    state: State<'_, AppState>,
    old_path: String,
    new_path: String,
) -> AppResult<AppSettings> {
    let file = world::read_world_file(Path::new(&new_path))?;
    let mut settings = state.settings.lock().await;
    let mut updated = settings.clone();
    updated.relocate_recent_world(
        &old_path,
        &new_path,
        &file.id.to_string(),
        &file.name,
        file.genre,
    )?;
    settings::save(&state.config_dir, &updated)?;
    *settings = updated.clone();
    Ok(updated)
}

/// Shows a world folder in the Windows Explorer. Only recent worlds are
/// accepted, so the front cannot make the app open arbitrary locations.
#[tauri::command]
#[specta::specta]
pub async fn reveal_in_explorer(state: State<'_, AppState>, path: String) -> AppResult<()> {
    if !state.settings.lock().await.is_recent_world(&path) {
        return Err(AppError::InvalidInput(format!(
            "not a recent world: {path}"
        )));
    }
    if !Path::new(&path).exists() {
        return Err(AppError::WorldInvalid(format!("folder not found: {path}")));
    }
    reveal(&path)
}

#[cfg(windows)]
fn reveal(path: &str) -> AppResult<()> {
    use std::os::windows::process::CommandExt;
    // Explorer parses `/select,"<path>"` itself: Rust's own quoting of the
    // whole argument would break paths containing spaces. Windows paths
    // cannot contain double quotes.
    let argument = format!("/select,\"{path}\"");
    std::process::Command::new("explorer")
        .raw_arg(argument)
        .spawn()?;
    Ok(())
}

#[cfg(not(windows))]
fn reveal(path: &str) -> AppResult<()> {
    Err(AppError::Internal(format!(
        "reveal is only supported on Windows: {path}"
    )))
}

/// Saves new preferences and returns the updated settings.
#[tauri::command]
#[specta::specta]
pub async fn update_preferences(
    state: State<'_, AppState>,
    preferences: Preferences,
) -> AppResult<AppSettings> {
    let mut settings = state.settings.lock().await;
    let mut updated = settings.clone();
    updated.preferences = preferences;
    settings::save(&state.config_dir, &updated)?;
    *settings = updated.clone();
    Ok(updated)
}
