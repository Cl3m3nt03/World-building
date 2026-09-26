//! App directories. By default they are the standard Windows locations; the
//! `BUILDERZ_HOME` environment variable moves all of them under one folder,
//! so the end-to-end tests (and anyone trying the app) never touch the real
//! settings, logs or Documents folder.
//!
//! | Directory | Default | With `BUILDERZ_HOME` |
//! |---|---|---|
//! | Settings | `%APPDATA%\app.builderz.desktop` | `$BUILDERZ_HOME\config` |
//! | Logs | `%LOCALAPPDATA%\app.builderz.desktop\logs` | `$BUILDERZ_HOME\logs` |
//! | New worlds (default) | `Documents\BuilderZ` | `$BUILDERZ_HOME\worlds` |

use std::path::PathBuf;

use tauri::{AppHandle, Manager, Runtime};

use crate::error::{AppError, AppResult};

pub const HOME_ENV: &str = "BUILDERZ_HOME";

fn home_override() -> Option<PathBuf> {
    std::env::var_os(HOME_ENV)
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
}

fn unavailable(name: &str) -> impl Fn(tauri::Error) -> AppError + '_ {
    move |error| AppError::PathUnavailable(format!("{name}: {error}"))
}

pub fn config_dir<R: Runtime>(app: &AppHandle<R>) -> AppResult<PathBuf> {
    match home_override() {
        Some(home) => Ok(home.join("config")),
        None => app.path().app_config_dir().map_err(unavailable("config")),
    }
}

pub fn log_dir<R: Runtime>(app: &AppHandle<R>) -> AppResult<PathBuf> {
    match home_override() {
        Some(home) => Ok(home.join("logs")),
        None => app.path().app_log_dir().map_err(unavailable("log")),
    }
}

/// Suggested parent folder for new worlds.
pub fn default_worlds_dir<R: Runtime>(app: &AppHandle<R>) -> AppResult<PathBuf> {
    match home_override() {
        Some(home) => Ok(home.join("worlds")),
        None => Ok(app
            .path()
            .document_dir()
            .map_err(unavailable("documents"))?
            .join("BuilderZ")),
    }
}
