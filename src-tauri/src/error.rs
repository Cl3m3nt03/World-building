//! Application error type, shared by every Tauri command.
//!
//! Serialized to the front as `{ code, message }`: the front translates `code`
//! (i18n key `errors.<code>`) and shows `message` only as a technical detail.

use serde::Serialize;
use specta::Type;

#[derive(Debug, thiserror::Error, Serialize, Type)]
#[serde(tag = "code", content = "message", rename_all = "snake_case")]
pub enum AppError {
    /// A file system operation failed.
    #[error("I/O error: {0}")]
    Io(String),
    /// A system directory (config, logs, data) could not be resolved.
    #[error("path unavailable: {0}")]
    PathUnavailable(String),
    /// The input sent by the front is not valid (empty name, bad path…).
    #[error("invalid input: {0}")]
    InvalidInput(String),
    /// A world cannot be created there: the folder exists and is not empty.
    #[error("world folder already exists: {0}")]
    WorldAlreadyExists(String),
    /// The folder is not a valid BuilderZ world (missing or corrupted files).
    #[error("invalid world: {0}")]
    WorldInvalid(String),
    /// The world was saved by a newer BuilderZ; it is left untouched.
    #[error("world is newer than this app: {0}")]
    WorldTooNew(String),
    /// The command needs an open world and none is open.
    #[error("no world is open")]
    NoWorldOpen(String),
    /// A database query failed.
    #[error("database error: {0}")]
    Database(String),
    /// Applying the database migrations failed; the backup is kept.
    #[error("migration failed: {0}")]
    Migration(String),
    /// Anything that should not happen; always a bug.
    #[error("internal error: {0}")]
    Internal(String),
}

pub type AppResult<T> = Result<T, AppError>;

impl From<std::io::Error> for AppError {
    fn from(error: std::io::Error) -> Self {
        Self::Io(error.to_string())
    }
}

impl From<sqlx::Error> for AppError {
    fn from(error: sqlx::Error) -> Self {
        Self::Database(error.to_string())
    }
}

impl From<sqlx::migrate::MigrateError> for AppError {
    fn from(error: sqlx::migrate::MigrateError) -> Self {
        Self::Migration(error.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_as_code_and_message() {
        let error = AppError::PathUnavailable("no config dir".into());
        let json = serde_json::to_value(&error).unwrap();
        assert_eq!(
            json,
            serde_json::json!({ "code": "path_unavailable", "message": "no config dir" })
        );
    }

    #[test]
    fn io_errors_convert() {
        let io = std::io::Error::new(std::io::ErrorKind::NotFound, "missing");
        let error = AppError::from(io);
        assert!(matches!(error, AppError::Io(ref message) if message == "missing"));
        assert_eq!(error.to_string(), "I/O error: missing");
    }
}
