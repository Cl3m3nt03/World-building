//! State shared by the commands, managed by Tauri.

use std::path::PathBuf;

use tokio::sync::Mutex;

use crate::settings::AppSettings;
use crate::world::OpenWorld;

pub struct AppState {
    /// App config directory, where `settings.json` lives.
    pub config_dir: PathBuf,
    pub settings: Mutex<AppSettings>,
    /// The open world. Only one world is open at a time.
    pub world: Mutex<Option<OpenWorld>>,
}

impl AppState {
    pub fn new(config_dir: PathBuf, settings: AppSettings) -> Self {
        Self {
            config_dir,
            settings: Mutex::new(settings),
            world: Mutex::new(None),
        }
    }
}
