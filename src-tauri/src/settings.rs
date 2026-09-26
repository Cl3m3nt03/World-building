//! App settings (language, theme, recent worlds), stored in
//! `settings.json` in the app config directory, never inside a world.
//!
//! Loading never fails: a missing file gives the defaults, and a corrupted
//! one is set aside as `settings.corrupted.json` before falling back to them.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use specta::Type;

use crate::error::{AppError, AppResult};
use crate::world::Genre;

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

/// How the radio moves on at the end of a track.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum RadioMode {
    /// Plays the tracks in order, then starts over.
    #[default]
    Loop,
    /// Plays the same track again.
    RepeatOne,
    /// Picks a random track.
    Shuffle,
}

/// Default radio volume, in percent.
pub const DEFAULT_RADIO_VOLUME: u8 = 70;

/// Preferences edited by the user in the settings.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Preferences {
    pub language: Language,
    pub theme: Theme,
    pub transparency_effects: bool,
    /// Radio volume, from 0 to 100.
    pub radio_volume: u8,
    pub radio_mode: RadioMode,
}

impl Default for Preferences {
    fn default() -> Self {
        Self {
            language: Language::default(),
            theme: Theme::default(),
            transparency_effects: true,
            radio_volume: DEFAULT_RADIO_VOLUME,
            radio_mode: RadioMode::default(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RecentWorld {
    /// Absolute path of the world folder.
    pub path: String,
    pub name: String,
    /// World id (unknown for entries saved by 0.1.0).
    pub id: Option<String>,
    pub genre: Option<Genre>,
    /// Whether a thumbnail is cached (`bzthumb://<id>`).
    pub thumbnail: bool,
    /// RFC 3339 date.
    pub last_opened_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub preferences: Preferences,
    /// Most recently opened first.
    pub recent_worlds: Vec<RecentWorld>,
    /// Folder proposed for new worlds; `None` means the default one
    /// (`Documents/BuilderZ`, see `paths::default_worlds_dir`).
    pub default_worlds_dir: Option<String>,
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
struct RawRecentWorld {
    path: String,
    name: String,
    id: Option<String>,
    genre: Option<Genre>,
    thumbnail: bool,
    last_opened_at: String,
}

impl<'de> Deserialize<'de> for RecentWorld {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let RawRecentWorld {
            path,
            name,
            id,
            genre,
            thumbnail,
            last_opened_at,
        } = RawRecentWorld::deserialize(deserializer)?;
        Ok(Self {
            path,
            name,
            id,
            genre,
            thumbnail,
            last_opened_at,
        })
    }
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
    // Read loosely: an out-of-range volume or an unknown mode must not make
    // the whole settings file look corrupted.
    radio_volume: serde_json::Value,
    radio_mode: serde_json::Value,
}

impl Default for RawPreferences {
    fn default() -> Self {
        let Preferences {
            language,
            theme,
            transparency_effects,
            ..
        } = Preferences::default();
        Self {
            language,
            theme,
            transparency_effects,
            radio_volume: serde_json::Value::Null,
            radio_mode: serde_json::Value::Null,
        }
    }
}

/// A volume in percent, clamped to 0..=100; the default when not a number.
fn radio_volume(value: &serde_json::Value) -> u8 {
    match value.as_f64() {
        // Clamped first, so the cast cannot truncate.
        #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
        Some(volume) if volume.is_finite() => volume.clamp(0.0, 100.0).round() as u8,
        _ => DEFAULT_RADIO_VOLUME,
    }
}

impl<'de> Deserialize<'de> for Preferences {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let RawPreferences {
            language,
            theme,
            transparency_effects,
            radio_volume: volume,
            radio_mode: mode,
        } = RawPreferences::deserialize(deserializer)?;
        Ok(Self {
            language,
            theme,
            transparency_effects,
            radio_volume: radio_volume(&volume),
            radio_mode: serde_json::from_value(mode).unwrap_or_default(),
        })
    }
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
struct RawAppSettings {
    preferences: Preferences,
    recent_worlds: Vec<RecentWorld>,
    default_worlds_dir: Option<String>,
}

impl<'de> Deserialize<'de> for AppSettings {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let RawAppSettings {
            preferences,
            recent_worlds,
            default_worlds_dir,
        } = RawAppSettings::deserialize(deserializer)?;
        Ok(Self {
            preferences,
            recent_worlds,
            default_worlds_dir,
        })
    }
}

impl AppSettings {
    /// Removes a world from the recent list (its folder is not touched).
    /// Returns whether it was there.
    pub fn remove_recent_world(&mut self, path: &str) -> bool {
        let before = self.recent_worlds.len();
        self.recent_worlds
            .retain(|recent| !same_path(&recent.path, path));
        self.recent_worlds.len() != before
    }

    /// Whether `path` is one of the recent worlds.
    pub fn is_recent_world(&self, path: &str) -> bool {
        self.recent_worlds
            .iter()
            .any(|recent| same_path(&recent.path, path))
    }

    /// Points the recent world at `old_path` to `new_path`, where the world
    /// described by `id`, `name` and `genre` now lives. Keeps its position.
    /// Refuses a different world than the one recorded.
    pub fn relocate_recent_world(
        &mut self,
        old_path: &str,
        new_path: &str,
        id: &str,
        name: &str,
        genre: Genre,
    ) -> AppResult<()> {
        let index = self
            .recent_worlds
            .iter()
            .position(|recent| same_path(&recent.path, old_path))
            .ok_or_else(|| AppError::InvalidInput(format!("not a recent world: {old_path}")))?;
        if let Some(known) = &self.recent_worlds[index].id
            && known != id
        {
            // The path alone: the front explains the problem in the user's language.
            return Err(AppError::WrongWorld(new_path.to_owned()));
        }
        // The new folder may already be in the list: keep a single entry.
        let duplicate = self
            .recent_worlds
            .iter()
            .enumerate()
            .find(|(other, recent)| *other != index && same_path(&recent.path, new_path))
            .map(|(other, _)| other);

        let recent = &mut self.recent_worlds[index];
        new_path.clone_into(&mut recent.path);
        name.clone_into(&mut recent.name);
        recent.id = Some(id.to_owned());
        recent.genre = Some(genre);
        if let Some(other) = duplicate {
            self.recent_worlds.remove(other);
        }
        Ok(())
    }

    /// Updates a recent world in place, keeping its position.
    pub fn update_recent_world(&mut self, path: &str, update: impl Fn(&mut RecentWorld)) {
        for recent in &mut self.recent_worlds {
            if same_path(&recent.path, path) {
                update(recent);
            }
        }
    }

    /// Sets the folder proposed for new worlds (`None` or blank resets it).
    /// It must be an absolute path.
    pub fn set_default_worlds_dir(&mut self, path: Option<&str>) -> AppResult<()> {
        let path = path.map(str::trim).filter(|path| !path.is_empty());
        if let Some(path) = path
            && !Path::new(path).is_absolute()
        {
            return Err(AppError::InvalidInput(format!(
                "path is not absolute: {path}"
            )));
        }
        self.default_worlds_dir = path.map(str::to_owned);
        Ok(())
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
            id: None,
            genre: None,
            thumbnail: false,
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
    fn radio_preferences_are_read_loosely() {
        let dir = tempfile::tempdir().unwrap();
        let write = |json: &str| std::fs::write(dir.path().join(SETTINGS_FILE), json).unwrap();

        write(r#"{ "preferences": { "radioVolume": 35, "radioMode": "shuffle" } }"#);
        let preferences = load(dir.path()).preferences;
        assert_eq!(preferences.radio_volume, 35);
        assert_eq!(preferences.radio_mode, RadioMode::Shuffle);

        write(
            r#"{ "preferences": { "theme": "dark", "radioVolume": 300, "radioMode": "party" } }"#,
        );
        let preferences = load(dir.path()).preferences;
        assert_eq!(preferences.theme, Theme::Dark);
        assert_eq!(preferences.radio_volume, 100);
        assert_eq!(preferences.radio_mode, RadioMode::Loop);

        write(r#"{ "preferences": { "radioVolume": "loud" } }"#);
        assert_eq!(
            load(dir.path()).preferences.radio_volume,
            DEFAULT_RADIO_VOLUME
        );
        assert!(!dir.path().join(CORRUPTED_FILE).exists());
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

        settings.update_recent_world("c:/a", |recent| recent.name = "Nouveau nom".into());

        assert_eq!(settings.recent_worlds[1].path, "C:/A");
        assert_eq!(settings.recent_worlds[1].name, "Nouveau nom");
        assert_eq!(settings.recent_worlds[0].name, "C:/B");
    }

    #[test]
    fn default_worlds_dir_must_be_absolute_and_can_be_reset() {
        let mut settings = AppSettings::default();
        assert!(matches!(
            settings.set_default_worlds_dir(Some("relative/dir")),
            Err(AppError::InvalidInput(_))
        ));
        let dir = tempfile::tempdir().unwrap();
        let absolute = dir.path().display().to_string();

        settings.set_default_worlds_dir(Some(&absolute)).unwrap();
        save(dir.path(), &settings).unwrap();
        assert_eq!(load(dir.path()).default_worlds_dir, Some(absolute));

        settings.set_default_worlds_dir(Some("   ")).unwrap();
        assert_eq!(settings.default_worlds_dir, None);
    }

    fn recent_with_id(path: &str, id: &str) -> RecentWorld {
        RecentWorld {
            id: Some(id.into()),
            ..recent(path)
        }
    }

    #[test]
    fn a_recent_world_can_be_removed() {
        let mut settings = AppSettings::default();
        settings.record_recent_world(recent("C:/A"));
        settings.record_recent_world(recent("C:/B"));

        assert!(settings.remove_recent_world("c:/a"));
        assert!(!settings.remove_recent_world("C:/A"));
        assert_eq!(settings.recent_worlds.len(), 1);
        assert!(settings.is_recent_world("C:/B"));
    }

    #[test]
    fn relocating_keeps_the_position_and_refuses_another_world() {
        let mut settings = AppSettings::default();
        settings.record_recent_world(recent_with_id("C:/Old", "id-1"));
        settings.record_recent_world(recent("C:/Other"));

        let other_world =
            settings.relocate_recent_world("C:/Old", "D:/New", "id-2", "X", Genre::Other);
        assert!(matches!(other_world, Err(AppError::WrongWorld(ref path)) if path == "D:/New"));

        settings
            .relocate_recent_world("C:/Old", "D:/New", "id-1", "Eldefleur", Genre::Fantasy)
            .unwrap();
        assert_eq!(settings.recent_worlds[1].path, "D:/New");
        assert_eq!(settings.recent_worlds[1].name, "Eldefleur");
        assert_eq!(settings.recent_worlds[1].genre, Some(Genre::Fantasy));
    }

    #[test]
    fn relocating_onto_a_listed_folder_leaves_one_entry() {
        let mut settings = AppSettings::default();
        settings.record_recent_world(recent_with_id("D:/New", "id-1"));
        settings.record_recent_world(recent_with_id("C:/Old", "id-1"));

        settings
            .relocate_recent_world("C:/Old", "D:/New", "id-1", "W", Genre::Other)
            .unwrap();

        assert_eq!(settings.recent_worlds.len(), 1);
        assert_eq!(settings.recent_worlds[0].path, "D:/New");
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
