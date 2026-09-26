use serde::Serialize;
use specta::Type;
use tauri::{AppHandle, Manager};

use crate::error::{AppError, AppResult};

/// Version and system directories of the running app.
#[derive(Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub version: String,
    pub config_dir: String,
    pub data_dir: String,
    pub log_dir: String,
}

fn path_error(name: &str) -> impl Fn(tauri::Error) -> AppError + '_ {
    move |error| AppError::PathUnavailable(format!("{name}: {error}"))
}

#[tauri::command]
#[specta::specta]
pub fn app_info(app: AppHandle) -> AppResult<AppInfo> {
    let paths = app.path();
    let info = AppInfo {
        version: app.package_info().version.to_string(),
        config_dir: paths
            .app_config_dir()
            .map_err(path_error("config"))?
            .display()
            .to_string(),
        data_dir: paths
            .app_data_dir()
            .map_err(path_error("data"))?
            .display()
            .to_string(),
        log_dir: paths
            .app_log_dir()
            .map_err(path_error("log"))?
            .display()
            .to_string(),
    };
    tracing::debug!(?info, "app_info");
    Ok(info)
}
