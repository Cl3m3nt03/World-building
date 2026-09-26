use tauri::State;

use crate::error::AppResult;
use crate::settings::{self, AppSettings, Preferences};
use crate::state::AppState;

/// App settings: preferences and recent worlds.
#[tauri::command]
#[specta::specta]
pub async fn get_settings(state: State<'_, AppState>) -> AppResult<AppSettings> {
    Ok(state.settings.lock().await.clone())
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
