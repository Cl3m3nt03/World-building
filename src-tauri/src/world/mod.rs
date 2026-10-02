//! A world is a self-contained folder (ADR 0001):
//!
//! ```text
//! MyWorld/
//! ├── world.json   metadata + schema_version
//! ├── world.db     SQLite, all structured data
//! └── assets/      imported files, named by content hash
//! ```
//!
//! Opening a world whose `schema_version` is older than the app first copies
//! `world.db` to `world.db.bak-v<old version>`, then migrates it. A world saved
//! by a newer app is refused and left untouched.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use specta::Type;
use sqlx::SqlitePool;
use sqlx::migrate::Migrator;
use time::OffsetDateTime;
use uuid::Uuid;

use crate::db;
use crate::error::{AppError, AppResult};

pub mod assets;
pub mod preferences;
pub mod storage;
pub mod theme;
pub mod tiles;

pub use preferences::WorldPreferences;
pub use theme::WorldTheme;

pub const WORLD_FILE: &str = "world.json";
pub const DB_FILE: &str = "world.db";
pub const ASSETS_DIR: &str = "assets";
/// Marker written in `world.json`, to recognize a BuilderZ world folder.
pub const FORMAT: &str = "builderz-world";

/// Longest world name, in characters.
pub const MAX_NAME_LEN: usize = 200;
/// Longest world description, in characters.
pub const MAX_DESCRIPTION_LEN: usize = 10_000;

/// Genre of a world. It decides the card types proposed by default (M2).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum Genre {
    Fantasy,
    ScienceFiction,
    Romance,
    Cyberpunk,
    Contemporary,
    #[default]
    Other,
}

/// Content of `world.json`.
///
/// Fields added after 0.1.0 (`genre`, `description`, `mainImage`, `theme`,
/// `preferences`) are optional when reading, so older worlds still open.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorldFile {
    pub format: String,
    pub id: Uuid,
    pub name: String,
    #[serde(default)]
    pub genre: Genre,
    #[serde(default)]
    pub description: String,
    /// Asset id (`<sha256>.<ext>`) of the main image, in `assets/`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub main_image: Option<String>,
    /// Absent: the default theme. Read tolerantly (see `theme`).
    #[serde(
        default,
        deserialize_with = "theme::deserialize_lenient",
        skip_serializing_if = "WorldTheme::is_default"
    )]
    pub theme: WorldTheme,
    /// Absent: all on. Read tolerantly (see `preferences`).
    #[serde(
        default,
        deserialize_with = "preferences::deserialize_lenient",
        skip_serializing_if = "WorldPreferences::is_default"
    )]
    pub preferences: WorldPreferences,
    /// Most bytes the world may take on the disk (3.12): imports are refused
    /// beyond. Absent: no limit. Read tolerantly (an unreadable value is no limit).
    #[serde(
        default,
        deserialize_with = "deserialize_limit",
        skip_serializing_if = "Option::is_none"
    )]
    pub storage_limit: Option<u64>,
    pub schema_version: i64,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub last_opened_at: OffsetDateTime,
}

/// A world as seen by the front.
#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct WorldInfo {
    pub id: String,
    pub name: String,
    pub genre: Genre,
    pub description: String,
    /// Asset id of the main image, if any.
    pub main_image: Option<String>,
    pub theme: WorldTheme,
    pub preferences: WorldPreferences,
    /// Storage limit in bytes, if any (f64: u64 has no safe JS type).
    pub storage_limit: Option<f64>,
    /// Absolute path of the world folder.
    pub path: String,
    pub schema_version: u32,
    /// RFC 3339 dates.
    pub created_at: String,
    pub last_opened_at: String,
}

/// An open world: its folder, its metadata and its database pool.
#[derive(Debug)]
pub struct OpenWorld {
    pub root: PathBuf,
    pub file: WorldFile,
    pub pool: SqlitePool,
}

impl OpenWorld {
    pub fn info(&self) -> WorldInfo {
        WorldInfo {
            id: self.file.id.to_string(),
            name: self.file.name.clone(),
            genre: self.file.genre,
            description: self.file.description.clone(),
            main_image: self.file.main_image.clone(),
            theme: self.file.theme.clone(),
            preferences: self.file.preferences,
            storage_limit: self.file.storage_limit.map(|limit| limit as f64),
            path: self.root.display().to_string(),
            schema_version: u32::try_from(self.file.schema_version).unwrap_or(u32::MAX),
            created_at: format_date(self.file.created_at),
            last_opened_at: format_date(self.file.last_opened_at),
        }
    }

    pub fn assets_dir(&self) -> PathBuf {
        self.root.join(ASSETS_DIR)
    }

    /// Applies `patch` to the metadata and saves `world.json`. Nothing is
    /// changed if validation or saving fails.
    pub fn update(&mut self, patch: WorldPatch) -> AppResult<()> {
        let mut file = self.file.clone();
        if let Some(name) = patch.name {
            file.name = validate_name(&name)?;
        }
        if let Some(genre) = patch.genre {
            file.genre = genre;
        }
        if let Some(description) = patch.description {
            if description.chars().count() > MAX_DESCRIPTION_LEN {
                return Err(AppError::InvalidInput(format!(
                    "description longer than {MAX_DESCRIPTION_LEN} characters"
                )));
            }
            file.description = description;
        }
        self.save(file)
    }

    /// Sets or clears the main image. The asset must exist in `assets/`.
    pub fn set_main_image(&mut self, asset_id: Option<String>) -> AppResult<()> {
        if let Some(id) = &asset_id {
            let path = assets::resolve(&self.assets_dir(), id)?;
            if !path.is_file() {
                return Err(AppError::InvalidInput(format!("asset not found: {id}")));
            }
        }
        let mut file = self.file.clone();
        file.main_image = asset_id;
        self.save(file)
    }

    /// Sets the theme. A custom background must exist in `assets/`.
    pub fn set_theme(&mut self, theme: WorldTheme) -> AppResult<()> {
        let theme = theme.validated()?;
        if let Some(id) = theme.background() {
            let path = assets::resolve(&self.assets_dir(), id)?;
            if !path.is_file() {
                return Err(AppError::InvalidInput(format!("asset not found: {id}")));
            }
        }
        let mut file = self.file.clone();
        file.theme = theme;
        self.save(file)
    }

    /// Sets the writing preferences.
    /// Sets (or removes, with `None`) the world's storage limit.
    pub fn set_storage_limit(&mut self, limit: Option<u64>) -> AppResult<()> {
        let mut file = self.file.clone();
        file.storage_limit = limit;
        self.save(file)
    }

    /// Folder of the world.
    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn set_preferences(&mut self, preferences: WorldPreferences) -> AppResult<()> {
        let mut file = self.file.clone();
        file.preferences = preferences;
        self.save(file)
    }

    /// The asset `id` was deleted: the world stops using it as its main
    /// image or theme background (a custom theme then shows the main image).
    /// Returns whether the main image was cleared.
    pub fn forget_asset(&mut self, id: &str) -> AppResult<bool> {
        let mut file = self.file.clone();
        let main_image = file.main_image.as_deref() == Some(id);
        if main_image {
            file.main_image = None;
        }
        let background = file.theme.background() == Some(id);
        if background && let WorldTheme::Custom { background, .. } = &mut file.theme {
            *background = None;
        }
        if main_image || background {
            self.save(file)?;
        }
        Ok(main_image)
    }

    fn save(&mut self, mut file: WorldFile) -> AppResult<()> {
        file.updated_at = now();
        write_world_file(&self.root, &file)?;
        self.file = file;
        Ok(())
    }

    /// Closes the database pool; WAL is checkpointed when the last connection closes.
    pub async fn close(self) {
        self.pool.close().await;
        tracing::info!(path = %self.root.display(), "world closed");
    }
}

fn format_date(date: OffsetDateTime) -> String {
    date.format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_else(|_| date.unix_timestamp().to_string())
}

fn now() -> OffsetDateTime {
    OffsetDateTime::now_utc()
}

/// Backup file written before migrating a database from `version`.
pub fn backup_path(root: &Path, version: i64) -> PathBuf {
    root.join(format!("{DB_FILE}.bak-v{version}"))
}

fn is_empty_dir(path: &Path) -> AppResult<bool> {
    Ok(std::fs::read_dir(path)?.next().is_none())
}

/// Writes `world.json` atomically (temporary file, then rename).
fn write_world_file(root: &Path, file: &WorldFile) -> AppResult<()> {
    let json = serde_json::to_string_pretty(file)
        .map_err(|error| AppError::Internal(format!("serialize world.json: {error}")))?;
    let tmp = root.join(format!("{WORLD_FILE}.tmp"));
    std::fs::write(&tmp, json)?;
    std::fs::rename(&tmp, root.join(WORLD_FILE))?;
    Ok(())
}

/// Reads the storage limit of `world.json` tolerantly: anything but a whole
/// number of bytes is no limit (with a warning), never a refusal to open.
fn deserialize_limit<'de, D>(deserializer: D) -> Result<Option<u64>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let value = serde_json::Value::deserialize(deserializer)?;
    match value.as_u64() {
        Some(limit) => Ok(Some(limit)),
        None if value.is_null() => Ok(None),
        None => {
            tracing::warn!(%value, "unreadable storage limit, no limit");
            Ok(None)
        }
    }
}

/// Reads and checks `world.json` in `root`, without opening the world.
pub fn read_world_file(root: &Path) -> AppResult<WorldFile> {
    let path = root.join(WORLD_FILE);
    let json = std::fs::read_to_string(&path).map_err(|error| {
        AppError::WorldInvalid(format!("cannot read {}: {error}", path.display()))
    })?;
    // Tolerate a UTF-8 BOM (files edited with Notepad or PowerShell 5).
    let file: WorldFile = serde_json::from_str(json.trim_start_matches('\u{feff}'))
        .map_err(|error| AppError::WorldInvalid(format!("{WORLD_FILE} is corrupted: {error}")))?;
    if file.format != FORMAT {
        return Err(AppError::WorldInvalid(format!(
            "{WORLD_FILE} has format {:?}, expected {FORMAT:?}",
            file.format
        )));
    }
    Ok(file)
}

/// Removes the folder of the world `id` with `remove` (the Windows recycle
/// bin in the app, a plain deletion in the tests), after checking that `root`
/// still holds that world: a deletion never touches another folder. The
/// world must be closed first.
pub fn remove_folder(
    root: &Path,
    id: Uuid,
    remove: impl FnOnce(&Path) -> AppResult<()>,
) -> AppResult<()> {
    let file = read_world_file(root)?;
    if file.id != id {
        return Err(AppError::WrongWorld(format!(
            "{} holds the world {}, not {id}",
            root.display(),
            file.id
        )));
    }
    remove(root)
}

/// Longest folder name derived from a world name.
const MAX_FOLDER_NAME_LEN: usize = 100;

/// Folder name for a world called `name`, safe on Windows: forbidden and
/// control characters removed, spaces collapsed, no trailing dot or space,
/// reserved device names (`CON`, `NUL`, `COM1`…) suffixed with `_`.
pub fn folder_name(name: &str) -> AppResult<String> {
    let cleaned: String = name
        .chars()
        .filter(|c| {
            !c.is_control() && !matches!(c, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*')
        })
        .collect();
    let mut folder = cleaned.split_whitespace().collect::<Vec<_>>().join(" ");
    if folder.chars().count() > MAX_FOLDER_NAME_LEN {
        folder = folder.chars().take(MAX_FOLDER_NAME_LEN).collect();
    }
    let folder = folder.trim_end_matches(['.', ' ']).to_owned();
    if folder.is_empty() {
        return Err(AppError::InvalidInput(format!(
            "no usable folder name in {name:?}"
        )));
    }

    let stem = folder
        .split('.')
        .next()
        .unwrap_or_default()
        .to_ascii_uppercase();
    let reserved = matches!(stem.as_str(), "CON" | "PRN" | "AUX" | "NUL")
        || ((stem.starts_with("COM") || stem.starts_with("LPT"))
            && stem.len() == 4
            && stem.as_bytes()[3].is_ascii_digit());
    Ok(if reserved {
        format!("{folder}_")
    } else {
        folder
    })
}

/// Changes to the metadata of the open world; absent fields are left as is.
#[derive(Debug, Clone, Default, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct WorldPatch {
    pub name: Option<String>,
    pub genre: Option<Genre>,
    pub description: Option<String>,
}

/// Trimmed, non-empty name of at most `MAX_NAME_LEN` characters.
fn validate_name(name: &str) -> AppResult<String> {
    let name = name.trim();
    if name.is_empty() {
        return Err(AppError::InvalidInput("world name is empty".into()));
    }
    if name.chars().count() > MAX_NAME_LEN {
        return Err(AppError::InvalidInput(format!(
            "world name longer than {MAX_NAME_LEN} characters"
        )));
    }
    Ok(name.to_owned())
}

/// Creates a new world of the default genre (used by the tests).
#[cfg(test)]
pub async fn create(root: &Path, name: &str, migrator: &Migrator) -> AppResult<OpenWorld> {
    create_with(root, name, Genre::default(), migrator).await
}

/// Creates a new world of the given genre in `root`, which must not exist or
/// be an empty folder.
pub async fn create_with(
    root: &Path,
    name: &str,
    genre: Genre,
    migrator: &Migrator,
) -> AppResult<OpenWorld> {
    let name = validate_name(name)?;
    let name = name.as_str();
    if !root.is_absolute() {
        return Err(AppError::InvalidInput(format!(
            "path is not absolute: {}",
            root.display()
        )));
    }

    let existed = root.exists();
    if existed && !(root.is_dir() && is_empty_dir(root)?) {
        return Err(AppError::WorldAlreadyExists(root.display().to_string()));
    }

    let result = create_in(root, name, genre, migrator).await;
    if result.is_err() {
        // Leave the disk as it was: remove what this call created.
        let cleanup = if existed {
            clear_dir(root)
        } else {
            std::fs::remove_dir_all(root).map_err(AppError::from)
        };
        if let Err(error) = cleanup {
            tracing::warn!(%error, path = %root.display(), "cleanup after failed world creation");
        }
    }
    result
}

fn clear_dir(root: &Path) -> AppResult<()> {
    for entry in std::fs::read_dir(root)? {
        let path = entry?.path();
        if path.is_dir() {
            std::fs::remove_dir_all(path)?;
        } else {
            std::fs::remove_file(path)?;
        }
    }
    Ok(())
}

async fn create_in(
    root: &Path,
    name: &str,
    genre: Genre,
    migrator: &Migrator,
) -> AppResult<OpenWorld> {
    std::fs::create_dir_all(root.join(ASSETS_DIR))?;

    let pool = db::connect(&root.join(DB_FILE), true).await?;
    if let Err(error) = migrator.run(&pool).await {
        pool.close().await;
        return Err(error.into());
    }

    let created = now();
    let file = WorldFile {
        format: FORMAT.into(),
        id: Uuid::new_v4(),
        name: name.into(),
        genre,
        description: String::new(),
        main_image: None,
        theme: WorldTheme::Default,
        preferences: WorldPreferences::default(),
        storage_limit: None,
        schema_version: db::latest_version(migrator),
        created_at: created,
        updated_at: created,
        last_opened_at: created,
    };
    if let Err(error) = write_world_file(root, &file) {
        pool.close().await;
        return Err(error);
    }

    tracing::info!(path = %root.display(), id = %file.id, "world created");
    Ok(OpenWorld {
        root: root.to_path_buf(),
        file,
        pool,
    })
}

/// Opens the world in `root`, migrating it if it comes from an older app.
pub async fn open(root: &Path, migrator: &Migrator) -> AppResult<OpenWorld> {
    let mut file = read_world_file(root)?;
    let latest = db::latest_version(migrator);
    if file.schema_version > latest {
        return Err(too_new(file.schema_version, latest));
    }

    let db_path = root.join(DB_FILE);
    if !db_path.is_file() {
        return Err(AppError::WorldInvalid(format!("{DB_FILE} is missing")));
    }

    let pool = db::connect(&db_path, false)
        .await
        .map_err(|error| AppError::WorldInvalid(format!("cannot open {DB_FILE}: {error}")))?;
    match prepare(root, &pool, &mut file, migrator).await {
        Ok(()) => Ok(OpenWorld {
            root: root.to_path_buf(),
            file,
            pool,
        }),
        Err(error) => {
            pool.close().await;
            Err(error)
        }
    }
}

fn too_new(found: i64, supported: i64) -> AppError {
    AppError::WorldTooNew(format!(
        "schema version {found}, this app supports up to {supported}"
    ))
}

/// Checks the database, backs it up and migrates it if needed, then updates
/// `world.json`.
async fn prepare(
    root: &Path,
    pool: &SqlitePool,
    file: &mut WorldFile,
    migrator: &Migrator,
) -> AppResult<()> {
    db::check_readable(pool)
        .await
        .map_err(|error| AppError::WorldInvalid(format!("{DB_FILE} is unreadable: {error}")))?;

    let latest = db::latest_version(migrator);
    let applied = db::applied_version(pool).await?.unwrap_or(0);
    if applied > latest {
        return Err(too_new(applied, latest));
    }

    let migrated = applied < latest;
    if migrated {
        let backup = backup_path(root, applied);
        db::backup_to(pool, &backup).await?;
        tracing::info!(from = applied, to = latest, backup = %backup.display(), "migrating world");
        migrator.run(pool).await?;
    }

    std::fs::create_dir_all(root.join(ASSETS_DIR))?;

    let opened = now();
    file.schema_version = latest;
    file.last_opened_at = opened;
    if migrated {
        file.updated_at = opened;
    }
    write_world_file(root, file)?;

    tracing::info!(path = %root.display(), id = %file.id, "world opened");
    Ok(())
}

#[cfg(test)]
mod tests;
