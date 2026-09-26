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

pub const WORLD_FILE: &str = "world.json";
pub const DB_FILE: &str = "world.db";
pub const ASSETS_DIR: &str = "assets";
/// Marker written in `world.json`, to recognize a BuilderZ world folder.
pub const FORMAT: &str = "builderz-world";

/// Content of `world.json`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorldFile {
    pub format: String,
    pub id: Uuid,
    pub name: String,
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
            path: self.root.display().to_string(),
            schema_version: u32::try_from(self.file.schema_version).unwrap_or(u32::MAX),
            created_at: format_date(self.file.created_at),
            last_opened_at: format_date(self.file.last_opened_at),
        }
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

fn read_world_file(root: &Path) -> AppResult<WorldFile> {
    let path = root.join(WORLD_FILE);
    let json = std::fs::read_to_string(&path).map_err(|error| {
        AppError::WorldInvalid(format!("cannot read {}: {error}", path.display()))
    })?;
    let file: WorldFile = serde_json::from_str(&json)
        .map_err(|error| AppError::WorldInvalid(format!("{WORLD_FILE} is corrupted: {error}")))?;
    if file.format != FORMAT {
        return Err(AppError::WorldInvalid(format!(
            "{WORLD_FILE} has format {:?}, expected {FORMAT:?}",
            file.format
        )));
    }
    Ok(file)
}

/// Creates a new world in `root`, which must not exist or be an empty folder.
pub async fn create(root: &Path, name: &str, migrator: &Migrator) -> AppResult<OpenWorld> {
    let name = name.trim();
    if name.is_empty() {
        return Err(AppError::InvalidInput("world name is empty".into()));
    }
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

    let result = create_in(root, name, migrator).await;
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

async fn create_in(root: &Path, name: &str, migrator: &Migrator) -> AppResult<OpenWorld> {
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
