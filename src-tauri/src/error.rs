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
