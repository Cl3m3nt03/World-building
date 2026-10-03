//! SQLite access for a world database (`world.db`).

pub mod assets;
pub mod canvases;
pub mod card_types;
pub mod cards;
pub mod documents;
pub mod graphs;
pub mod links;
pub mod maps;
pub mod properties;
pub mod relations;
pub mod search;
pub mod tree;
pub mod trees;
pub mod ui_state;
pub mod wiki;

use std::path::Path;
use std::time::Duration;

use sqlx::migrate::Migrator;
use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteSynchronous};
use sqlx::{Sqlite, SqlitePool, Transaction};

use crate::error::{AppError, AppResult};

/// Migrations of the world database, embedded in the binary.
pub static MIGRATOR: Migrator = sqlx::migrate!("./migrations");

/// Highest migration version known by a migrator: the schema version a world
/// has once fully migrated.
pub fn latest_version(migrator: &Migrator) -> i64 {
    migrator
        .iter()
        .map(|migration| migration.version)
        .max()
        .unwrap_or(0)
}

/// Opens a connection pool on `path`: WAL journal, foreign keys enforced.
/// With `create = false`, a missing file is an error instead of a new database.
pub async fn connect(path: &Path, create: bool) -> AppResult<SqlitePool> {
    let options = SqliteConnectOptions::new()
        .filename(path)
        .create_if_missing(create)
        .journal_mode(SqliteJournalMode::Wal)
        .synchronous(SqliteSynchronous::Normal)
        .foreign_keys(true)
        .busy_timeout(Duration::from_secs(5));

    Ok(SqlitePoolOptions::new()
        .max_connections(4)
        .connect_with(options)
        .await?)
}

/// Begins a transaction that writes: `BEGIN IMMEDIATE` takes the write lock
/// at once, so a concurrent writer waits (`busy_timeout`) instead of failing.
/// A deferred `BEGIN` that reads then writes gets `SQLITE_BUSY` at once in
/// WAL mode when another connection wrote in between, timeout or not (#140).
#[allow(clippy::disallowed_methods)]
pub async fn begin_write(pool: &SqlitePool) -> AppResult<Transaction<'static, Sqlite>> {
    Ok(pool.begin_with("BEGIN IMMEDIATE").await?)
}

/// Fails if the file is not a readable SQLite database.
pub async fn check_readable(pool: &SqlitePool) -> AppResult<()> {
    sqlx::query_scalar!(r#"SELECT COUNT(*) AS "count!: i64" FROM sqlite_master"#)
        .fetch_one(pool)
        .await?;
    Ok(())
}

/// Highest migration applied to this database, if any.
pub async fn applied_version(pool: &SqlitePool) -> AppResult<Option<i64>> {
    let exists = sqlx::query_scalar!(
        r#"SELECT COUNT(*) AS "count!: i64" FROM sqlite_master
           WHERE type = 'table' AND name = '_sqlx_migrations'"#
    )
    .fetch_one(pool)
    .await?;
    if exists == 0 {
        return Ok(None);
    }

    let version = sqlx::query_scalar!(
        r#"SELECT MAX(version) AS "version: i64" FROM _sqlx_migrations WHERE success = 1"#
    )
    .fetch_one(pool)
    .await?;
    Ok(version)
}

/// Writes a consistent copy of the database to `target` (`VACUUM INTO`),
/// replacing any previous file there.
pub async fn backup_to(pool: &SqlitePool, target: &Path) -> AppResult<()> {
    if target.exists() {
        std::fs::remove_file(target)?;
    }
    let target = target
        .to_str()
        .ok_or_else(|| AppError::InvalidInput(format!("non UTF-8 path: {}", target.display())))?;
    sqlx::query!("VACUUM INTO ?", target).execute(pool).await?;
    Ok(())
}
