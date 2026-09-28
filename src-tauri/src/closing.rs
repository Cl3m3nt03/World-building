//! Closing the main window without losing the last edits.
//!
//! Text typed in the front is saved a short time after the last keystroke.
//! When the window is asked to close, the close is held back and the front
//! is told (`BEFORE_CLOSE_EVENT`): it saves its pending edits, then calls
//! `finish_close`. The app ends anyway after `CLOSE_TIMEOUT`, so a stuck
//! front never keeps it open, and a second close request (clicking the
//! cross again) closes it at once.

use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use tauri::{CloseRequestApi, Emitter, Manager, Window};

use crate::error::AppResult;

/// Event sent to the front when the window is asked to close.
pub const BEFORE_CLOSE_EVENT: &str = "bz://before-close";

/// Longest wait for the front before closing anyway.
const CLOSE_TIMEOUT: Duration = Duration::from_secs(5);

/// Whether a close was already requested (and held back once).
#[derive(Default)]
pub struct Closing(AtomicBool);

/// Handles a close request of `window`: the first one is held back while the
/// front saves; any later one lets the window close.
pub fn on_close_requested(window: &Window, closing: &Closing, api: &CloseRequestApi) {
    if closing.0.swap(true, Ordering::SeqCst) {
        return;
    }
    api.prevent_close();
    if let Err(error) = window.emit(BEFORE_CLOSE_EVENT, ()) {
        tracing::warn!(%error, "cannot ask the front to save before closing");
        exit(window);
        return;
    }
    let window = window.clone();
    std::thread::spawn(move || {
        std::thread::sleep(CLOSE_TIMEOUT);
        tracing::warn!("the front did not finish saving in time, closing anyway");
        exit(&window);
    });
}

/// Ends the app (it has a single window). Closing the window itself fails
/// once a close request was held back (WebView2: "failed to send message to
/// the webview"), exiting does not.
fn exit(window: &Window) {
    window.app_handle().exit(0);
}

/// Closes the app once the front has saved its pending edits.
#[tauri::command]
#[specta::specta]
pub async fn finish_close(window: Window) -> AppResult<()> {
    exit(&window);
    Ok(())
}
