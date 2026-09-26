use serde::Serialize;
use specta::Type;
use tauri::{AppHandle, Manager};

use crate::error::{AppError, AppResult};
use crate::paths;

/// Version and system directories of the running app.
#[derive(Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub version: String,
    pub config_dir: String,
    pub data_dir: String,
    pub log_dir: String,
}

#[tauri::command]
#[specta::specta]
pub fn app_info(app: AppHandle) -> AppResult<AppInfo> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| AppError::PathUnavailable(format!("data: {error}")))?;
    let info = AppInfo {
        version: app.package_info().version.to_string(),
        config_dir: paths::config_dir(&app)?.display().to_string(),
        data_dir: data_dir.display().to_string(),
        log_dir: paths::log_dir(&app)?.display().to_string(),
    };
    tracing::debug!(?info, "app_info");
    Ok(info)
}

/// Suggested parent folder for new worlds (`Documents\BuilderZ` by default).
#[tauri::command]
#[specta::specta]
pub fn default_worlds_dir(app: AppHandle) -> AppResult<String> {
    Ok(paths::default_worlds_dir(&app)?.display().to_string())
}
