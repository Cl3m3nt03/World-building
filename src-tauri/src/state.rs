//! State shared by the commands, managed by Tauri.

use std::path::PathBuf;

use tokio::sync::Mutex;

use crate::error::AppResult;
use crate::library::{self, Library};
use crate::settings::AppSettings;
use crate::world::OpenWorld;

pub struct AppState {
    /// App config directory, where `settings.json` lives.
    pub config_dir: PathBuf,
    pub settings: Mutex<AppSettings>,
    /// The open world. Only one world is open at a time.
    pub world: Mutex<Option<OpenWorld>>,
    /// The library shared by the worlds, opened on first use (ADR 0006).
    library: Mutex<Option<Library>>,
}

impl AppState {
    pub fn new(config_dir: PathBuf, settings: AppSettings) -> Self {
        Self {
            config_dir,
            settings: Mutex::new(settings),
            world: Mutex::new(None),
            library: Mutex::new(None),
        }
    }

    /// The library shared by the worlds, opened (or created) on first use.
    pub async fn library(&self) -> AppResult<Library> {
        let mut guard = self.library.lock().await;
        if let Some(library) = guard.as_ref() {
            return Ok(library.clone());
        }
        let opened = library::open(&self.config_dir).await?;
        *guard = Some(opened.clone());
        Ok(opened)
    }
}
