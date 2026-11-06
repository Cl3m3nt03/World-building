//! App directories. By default they are the standard Windows locations; the
//! `BUILDERZ_HOME` environment variable moves all of them under one folder,
//! so the end-to-end tests (and anyone trying the app) never touch the real
//! settings, logs or Documents folder.
//!
//! | Directory | Default | With `BUILDERZ_HOME` |
//! |---|---|---|
//! | Settings | `%APPDATA%\app.builderz.desktop` | `$BUILDERZ_HOME\config` |
//! | Logs | `%LOCALAPPDATA%\app.builderz.desktop\logs` | `$BUILDERZ_HOME\logs` |
//! | New worlds (default) | `Documents\Atlasaga`, or `Documents\BuilderZ` if it exists | `$BUILDERZ_HOME\worlds` |
//!
//! The app was called BuilderZ up to 1.7.x (ADR 0016): the bundle identifier
//! and the `BUILDERZ_*` variables keep that name so nothing moves.

use std::path::{Path, PathBuf};

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

/// Folder of new worlds under Documents since the rename (ADR 0016).
const WORLDS_FOLDER: &str = "Atlasaga";
/// The one used up to 1.7.x, when the app was called BuilderZ.
const LEGACY_WORLDS_FOLDER: &str = "BuilderZ";

/// Suggested parent folder for new worlds.
pub fn default_worlds_dir<R: Runtime>(app: &AppHandle<R>) -> AppResult<PathBuf> {
    match home_override() {
        Some(home) => Ok(home.join("worlds")),
        None => Ok(worlds_dir_in(
            &app.path()
                .document_dir()
                .map_err(unavailable("documents"))?,
        )),
    }
}

/// `documents\BuilderZ` when it exists (someone who used the app before the
/// rename keeps their new worlds next to the old ones), else
/// `documents\Atlasaga`.
fn worlds_dir_in(documents: &Path) -> PathBuf {
    let legacy = documents.join(LEGACY_WORLDS_FOLDER);
    if legacy.is_dir() {
        legacy
    } else {
        documents.join(WORLDS_FOLDER)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_worlds_go_to_atlasaga_without_a_builderz_folder() {
        let documents = tempfile::tempdir().unwrap();
        assert_eq!(
            worlds_dir_in(documents.path()),
            documents.path().join("Atlasaga")
        );
    }

    #[test]
    fn an_existing_builderz_folder_stays_the_default() {
        let documents = tempfile::tempdir().unwrap();
        std::fs::create_dir(documents.path().join("BuilderZ")).unwrap();
        assert_eq!(
            worlds_dir_in(documents.path()),
            documents.path().join("BuilderZ")
        );
    }

    #[test]
    fn a_builderz_file_is_not_a_worlds_folder() {
        let documents = tempfile::tempdir().unwrap();
        std::fs::write(documents.path().join("BuilderZ"), b"").unwrap();
        assert_eq!(
            worlds_dir_in(documents.path()),
            documents.path().join("Atlasaga")
        );
    }
}
