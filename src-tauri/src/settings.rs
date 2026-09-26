//! App settings (language, theme, recent worlds), stored in
//! `settings.json` in the app config directory, never inside a world.
//!
//! Loading never fails: a missing file gives the defaults, and a corrupted
//! one is set aside as `settings.corrupted.json` before falling back to them.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use specta::Type;

use crate::error::{AppError, AppResult};

pub const SETTINGS_FILE: &str = "settings.json";
const CORRUPTED_FILE: &str = "settings.corrupted.json";
/// Number of worlds kept in the recent list.
pub const MAX_RECENT_WORLDS: usize = 10;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum Language {
    #[default]
    Fr,
    En,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    Light,
    Dark,
    #[default]
    System,
}

/// Preferences edited by the user in the settings.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Preferences {
    pub language: Language,
    pub theme: Theme,
    pub transparency_effects: bool,
}

impl Default for Preferences {
    fn default() -> Self {
        Self {
            language: Language::default(),
            theme: Theme::default(),
            transparency_effects: true,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RecentWorld {
    /// Absolute path of the world folder.
    pub path: String,
    pub name: String,
    /// RFC 3339 date.
    pub last_opened_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub preferences: Preferences,
    /// Most recently opened first.
    pub recent_worlds: Vec<RecentWorld>,
}

// Reading is tolerant: missing fields take their default and unknown fields
// are ignored, so an older or newer settings.json still loads. This lives in
// private `Raw*` types because `#[serde(default)]` on the public ones would
// make every field optional in the generated TypeScript.

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct RawPreferences {
    language: Language,
    theme: Theme,
    transparency_effects: bool,
}

impl Default for RawPreferences {
    fn default() -> Self {
        let Preferences {
            language,
            theme,
            transparency_effects,
        } = Preferences::default();
        Self {
            language,
            theme,
            transparency_effects,
        }
    }
}

impl<'de> Deserialize<'de> for Preferences {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let RawPreferences {
            language,
            theme,
            transparency_effects,
        } = RawPreferences::deserialize(deserializer)?;
        Ok(Self {
            language,
            theme,
            transparency_effects,
        })
    }
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
struct RawAppSettings {
    preferences: Preferences,
    recent_worlds: Vec<RecentWorld>,
}

impl<'de> Deserialize<'de> for AppSettings {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let RawAppSettings {
            preferences,
            recent_worlds,
        } = RawAppSettings::deserialize(deserializer)?;
        Ok(Self {
            preferences,
            recent_worlds,
        })
    }
}

impl AppSettings {
    /// Updates the displayed name of a recent world, keeping its position.
    pub fn rename_recent_world(&mut self, path: &str, name: &str) {
        for recent in &mut self.recent_worlds {
            if same_path(&recent.path, path) {
                name.clone_into(&mut recent.name);
            }
        }
    }

    /// Moves (or adds) a world to the top of the recent list.
    pub fn record_recent_world(&mut self, world: RecentWorld) {
        self.recent_worlds
            .retain(|recent| !same_path(&recent.path, &world.path));
        self.recent_worlds.insert(0, world);
        self.recent_worlds.truncate(MAX_RECENT_WORLDS);
    }
}

/// Windows paths are case-insensitive.
fn same_path(a: &str, b: &str) -> bool {
    if cfg!(windows) {
        a.eq_ignore_ascii_case(b)
    } else {
        a == b
    }
}

fn settings_path(config_dir: &Path) -> PathBuf {
    config_dir.join(SETTINGS_FILE)
}

pub fn load(config_dir: &Path) -> AppSettings {
    let path = settings_path(config_dir);
    let json = match std::fs::read_to_string(&path) {
        Ok(json) => json,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return AppSettings::default();
        }
        Err(error) => {
            tracing::warn!(%error, path = %path.display(), "cannot read settings, using defaults");
            return AppSettings::default();
        }
    };

    // Tolerate a UTF-8 BOM (files edited with Notepad or PowerShell 5).
    match serde_json::from_str(json.trim_start_matches('\u{feff}')) {
        Ok(settings) => settings,
        Err(error) => {
            tracing::warn!(%error, "settings file is corrupted, using defaults");
            if let Err(error) = std::fs::rename(&path, config_dir.join(CORRUPTED_FILE)) {
                tracing::warn!(%error, "cannot set the corrupted settings file aside");
            }
            AppSettings::default()
        }
    }
}

/// Writes the settings atomically (temporary file, then rename).
pub fn save(config_dir: &Path, settings: &AppSettings) -> AppResult<()> {
    std::fs::create_dir_all(config_dir)?;
    let json = serde_json::to_string_pretty(settings)
        .map_err(|error| AppError::Internal(format!("serialize settings: {error}")))?;
    let path = settings_path(config_dir);
    let tmp = path.with_extension("json.tmp");
    std::fs::write(&tmp, json)?;
    std::fs::rename(&tmp, &path)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn recent(path: &str) -> RecentWorld {
        RecentWorld {
            path: path.into(),
            name: path.into(),
            last_opened_at: String::new(),
        }
    }

    #[test]
    fn missing_file_gives_defaults() {
        let dir = tempfile::tempdir().unwrap();
        let settings = load(dir.path());
        assert_eq!(settings, AppSettings::default());
        assert_eq!(settings.preferences.language, Language::Fr);
        assert_eq!(settings.preferences.theme, Theme::System);
        assert!(settings.preferences.transparency_effects);
    }

    #[test]
    fn save_then_load_roundtrips() {
        let dir = tempfile::tempdir().unwrap();
        let mut settings = AppSettings::default();
        settings.preferences.language = Language::En;
        settings.preferences.theme = Theme::Dark;
        settings.record_recent_world(recent("C:\\Worlds\\A"));

        save(dir.path(), &settings).unwrap();
        assert_eq!(load(dir.path()), settings);
    }

    #[test]
    fn corrupted_file_gives_defaults_and_is_set_aside() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join(SETTINGS_FILE), "{ not json").unwrap();

        assert_eq!(load(dir.path()), AppSettings::default());
        assert!(dir.path().join(CORRUPTED_FILE).exists());
        assert!(!dir.path().join(SETTINGS_FILE).exists());
    }

    #[test]
    fn unknown_and_missing_fields_are_tolerated() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(
            dir.path().join(SETTINGS_FILE),
            r#"{ "preferences": { "theme": "dark" }, "futureField": 1 }"#,
        )
        .unwrap();

        let settings = load(dir.path());
        assert_eq!(settings.preferences.theme, Theme::Dark);
        assert_eq!(settings.preferences.language, Language::Fr);
    }

    #[test]
    fn a_utf8_bom_is_tolerated() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(
            dir.path().join(SETTINGS_FILE),
            "\u{feff}{ \"preferences\": { \"language\": \"en\" } }",
        )
        .unwrap();

        assert_eq!(load(dir.path()).preferences.language, Language::En);
        assert!(!dir.path().join(CORRUPTED_FILE).exists());
    }

    #[test]
    fn renaming_a_recent_world_keeps_its_position() {
        let mut settings = AppSettings::default();
        settings.record_recent_world(recent("C:/A"));
        settings.record_recent_world(recent("C:/B"));

        settings.rename_recent_world("c:/a", "Nouveau nom");

        assert_eq!(settings.recent_worlds[1].path, "C:/A");
        assert_eq!(settings.recent_worlds[1].name, "Nouveau nom");
        assert_eq!(settings.recent_worlds[0].name, "C:/B");
    }

    #[test]
    fn recent_worlds_are_deduplicated_and_capped() {
        let mut settings = AppSettings::default();
        for index in 0..12 {
            settings.record_recent_world(recent(&format!("C:\\W{index}")));
        }
        assert_eq!(settings.recent_worlds.len(), MAX_RECENT_WORLDS);
        assert_eq!(settings.recent_worlds[0].path, "C:\\W11");

        settings.record_recent_world(recent("C:\\W5"));
        assert_eq!(settings.recent_worlds[0].path, "C:\\W5");
        assert_eq!(
            settings
                .recent_worlds
                .iter()
                .filter(|w| w.path == "C:\\W5")
                .count(),
            1
        );
    }
}
