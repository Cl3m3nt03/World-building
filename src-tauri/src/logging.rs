//! Logging: `tracing` to a daily-rotated file in the app log directory
//! (`%LOCALAPPDATA%\app.builderz.desktop\logs` on Windows), plus stderr in
//! debug builds. The level can be overridden with `RUST_LOG`.

use std::path::Path;

use tracing_appender::non_blocking::WorkerGuard;
use tracing_appender::rolling::{RollingFileAppender, Rotation};
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;
use tracing_subscriber::{EnvFilter, fmt};

use crate::error::{AppError, AppResult};

/// Number of daily log files kept before the oldest is deleted.
const MAX_LOG_FILES: usize = 14;
const DEFAULT_FILTER: &str = "info,builderz_lib=debug";

/// Keeps the background log writer alive; dropping it flushes the file.
pub struct LogGuard(#[allow(dead_code)] WorkerGuard);

pub fn init(log_dir: &Path) -> AppResult<LogGuard> {
    std::fs::create_dir_all(log_dir)?;

    let appender = RollingFileAppender::builder()
        .rotation(Rotation::DAILY)
        .filename_prefix("builderz")
        .filename_suffix("log")
        .max_log_files(MAX_LOG_FILES)
        .build(log_dir)
        .map_err(|error| AppError::Io(error.to_string()))?;
    let (file_writer, guard) = tracing_appender::non_blocking(appender);

    let filter =
        EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new(DEFAULT_FILTER));
    let file_layer = fmt::layer().with_writer(file_writer).with_ansi(false);
    let stderr_layer = cfg!(debug_assertions).then(|| fmt::layer().with_writer(std::io::stderr));

    tracing_subscriber::registry()
        .with(filter)
        .with(file_layer)
        .with(stderr_layer)
        .try_init()
        .map_err(|error| AppError::Internal(format!("logging already initialized: {error}")))?;

    Ok(LogGuard(guard))
}
