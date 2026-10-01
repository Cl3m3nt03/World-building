//! Space used by a world (or the library) on the disk, the space left, and
//! the optional limit chosen for a world (M3 step 3.12). The limit is kept
//! in `world.json` (ADR 0004); when it is reached, imports are refused and
//! nothing else is blocked.

use std::path::Path;

use serde::Serialize;
use specta::Type;

use crate::error::{AppError, AppResult};

/// Smallest limit a world accepts: 10 MB.
pub const MIN_LIMIT: u64 = 10 * 1024 * 1024;

/// Sizes in bytes (f64: u64 has no safe JS type).
#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct StorageUsage {
    /// The database with its journal files.
    pub database: f64,
    /// Files of `assets/`.
    pub media: f64,
    pub media_count: u32,
    /// Database copies made before migrations (`world.db.bak-*`).
    pub backups: f64,
    /// The whole folder.
    pub total: f64,
    /// Space left on the folder's disk, if it can be read.
    pub available: Option<f64>,
    /// Limit chosen for the world, if any.
    pub limit: Option<f64>,
}

/// Size of a file, or of a folder and everything under it.
fn size_of(path: &Path) -> u64 {
    let Ok(metadata) = std::fs::symlink_metadata(path) else {
        return 0;
    };
    if !metadata.is_dir() {
        return metadata.len();
    }
    std::fs::read_dir(path)
        .map(|entries| entries.flatten().map(|entry| size_of(&entry.path())).sum())
        .unwrap_or(0)
}

/// Space used under `root`, whose database is the file `database` and
/// media `assets/`; `limit` is the world's limit, if any.
pub fn usage(root: &Path, database: &str, limit: Option<u64>) -> StorageUsage {
    let mut database_size = 0;
    let mut backups = 0;
    if let Ok(entries) = std::fs::read_dir(root) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().into_owned();
            let size = size_of(&entry.path());
            if name.starts_with(&format!("{database}.bak")) {
                backups += size;
            } else if name == database
                || name == format!("{database}-wal")
                || name == format!("{database}-shm")
            {
                database_size += size;
            }
        }
    }
    let assets = root.join("assets");
    let media_count = std::fs::read_dir(&assets)
        .map(|entries| {
            entries
                .flatten()
                .filter(|entry| entry.path().is_file())
                .count()
        })
        .unwrap_or(0);
    StorageUsage {
        database: database_size as f64,
        media: size_of(&assets) as f64,
        media_count: u32::try_from(media_count).unwrap_or(u32::MAX),
        backups: backups as f64,
        total: size_of(root) as f64,
        available: match fs4::available_space(root) {
            Ok(space) => Some(space as f64),
            Err(error) => {
                tracing::debug!(%error, "free disk space unreadable");
                None
            }
        },
        limit: limit.map(|limit| limit as f64),
    }
}

/// Fails when the world under `root` has reached its `limit`.
pub fn check_room(root: &Path, limit: Option<u64>) -> AppResult<()> {
    let Some(limit) = limit else {
        return Ok(());
    };
    if size_of(root) >= limit {
        return Err(limit_reached(limit));
    }
    Ok(())
}

/// Whether the world under `root` is now over its `limit`.
pub fn is_over(root: &Path, limit: Option<u64>) -> bool {
    limit.is_some_and(|limit| size_of(root) > limit)
}

pub fn limit_reached(limit: u64) -> AppError {
    AppError::StorageLimitReached(format!("{limit} bytes"))
}

/// Checks a limit sent by the front: a whole number of bytes, at least
/// [`MIN_LIMIT`]. `None` removes the limit.
pub fn validate_limit(limit: Option<f64>) -> AppResult<Option<u64>> {
    match limit {
        None => Ok(None),
        Some(value) if value.is_finite() && value.fract() == 0.0 && value >= MIN_LIMIT as f64 => {
            Ok(Some(value as u64))
        }
        Some(value) => Err(AppError::InvalidInput(format!(
            "a storage limit is a whole number of bytes, at least {MIN_LIMIT}: {value}"
        ))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn usage_splits_the_database_media_and_backups() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        std::fs::write(root.join("world.json"), "{}").unwrap();
        std::fs::write(root.join("world.db"), vec![0; 100]).unwrap();
        std::fs::write(root.join("world.db-wal"), vec![0; 20]).unwrap();
        std::fs::write(root.join("world.db.bak-v6"), vec![0; 50]).unwrap();
        std::fs::create_dir(root.join("assets")).unwrap();
        std::fs::write(root.join("assets").join("a.png"), vec![0; 300]).unwrap();
        std::fs::write(root.join("assets").join("b.png"), vec![0; 200]).unwrap();

        let usage = usage(root, "world.db", Some(MIN_LIMIT));

        assert_eq!(usage.database, 120.0);
        assert_eq!(usage.media, 500.0);
        assert_eq!(usage.media_count, 2);
        assert_eq!(usage.backups, 50.0);
        assert_eq!(usage.total, 672.0);
        assert_eq!(usage.limit, Some(MIN_LIMIT as f64));
        assert!(usage.available.is_some_and(|space| space > 0.0));
    }

    #[test]
    fn the_limit_is_checked_and_validated() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("world.db"), vec![0; 1000]).unwrap();

        assert!(check_room(dir.path(), None).is_ok());
        assert!(check_room(dir.path(), Some(2000)).is_ok());
        assert!(matches!(
            check_room(dir.path(), Some(1000)),
            Err(AppError::StorageLimitReached(_))
        ));
        assert!(is_over(dir.path(), Some(999)));
        assert!(!is_over(dir.path(), Some(1000)));
        assert!(!is_over(dir.path(), None));

        assert_eq!(validate_limit(None).unwrap(), None);
        assert_eq!(
            validate_limit(Some(MIN_LIMIT as f64)).unwrap(),
            Some(MIN_LIMIT)
        );
        for bad in [1.0, -5.0, f64::NAN, MIN_LIMIT as f64 + 0.5] {
            assert!(validate_limit(Some(bad)).is_err(), "{bad}");
        }
    }
}
