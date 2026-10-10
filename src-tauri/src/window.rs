//! Main window creation.
//!
//! The window is declared in `tauri.conf.json` with `"create": false` and
//! built here, to control the WebView2 browser arguments.
//!
//! Tauri passes its own arguments to WebView2 through the API
//! (`--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection`). On some
//! machines, such as the GitHub Windows runner, those replace the arguments
//! given in the `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` environment variable
//! instead of adding to them. msedgedriver relies on that variable (for
//! `--remote-debugging-port`), so the end-to-end tests could never connect.
//! The two sets are merged here instead.

use tauri::{App, WebviewWindowBuilder};

use crate::error::{AppError, AppResult};

/// Features Tauri disables by default in WebView2.
const DEFAULT_DISABLED_FEATURES: &[&str] = &["msWebOOUI", "msPdfOOUI", "msSmartScreenProtection"];
const DISABLE_FEATURES: &str = "--disable-features=";
pub const BROWSER_ARGS_ENV: &str = "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS";

/// Debug builds only: set to `1`, the window opens out of the screens, without
/// taking the focus nor showing in the taskbar. The real-app checks and the
/// local end-to-end tests drive it through DevTools while the person keeps
/// using the computer (a game on the main screen…).
pub const BACKGROUND_WINDOW_ENV: &str = "BUILDERZ_BACKGROUND_WINDOW";

/// Where a background window goes: far outside any screen.
const OFF_SCREEN: f64 = -20_000.0;

/// Whether the window should open in the background (debug builds only).
fn background_window() -> bool {
    cfg!(debug_assertions) && std::env::var(BACKGROUND_WINDOW_ENV).is_ok_and(|value| value == "1")
}

/// WebView2 arguments: Tauri's defaults plus those from `extra` (the
/// environment variable), with every `--disable-features` list merged into one.
pub fn browser_args(extra: Option<&str>) -> String {
    let mut disabled: Vec<&str> = DEFAULT_DISABLED_FEATURES.to_vec();
    let mut others: Vec<&str> = Vec::new();

    for arg in extra.unwrap_or_default().split_whitespace() {
        match arg.strip_prefix(DISABLE_FEATURES) {
            Some(features) => {
                for feature in features.split(',').filter(|feature| !feature.is_empty()) {
                    if !disabled.contains(&feature) {
                        disabled.push(feature);
                    }
                }
            }
            None => others.push(arg),
        }
    }

    let mut args = format!("{DISABLE_FEATURES}{}", disabled.join(","));
    for arg in others {
        args.push(' ');
        args.push_str(arg);
    }
    args
}

/// Builds the main window from its configuration in `tauri.conf.json`.
pub fn create_main_window(app: &App) -> AppResult<()> {
    let mut config = app
        .config()
        .app
        .windows
        .first()
        .cloned()
        .ok_or_else(|| AppError::Internal("no window in tauri.conf.json".into()))?;
    let extra = std::env::var(BROWSER_ARGS_ENV).ok();
    let background = background_window();
    if background {
        // `center` would bring it back on the main screen.
        config.center = false;
        config.x = Some(OFF_SCREEN);
        config.y = Some(OFF_SCREEN);
        config.focus = false;
        config.skip_taskbar = true;
    }

    let window = WebviewWindowBuilder::from_config(app.handle(), &config)
        .and_then(|builder| {
            builder
                .additional_browser_args(&browser_args(extra.as_deref()))
                .build()
        })
        .map_err(|error| AppError::Internal(format!("cannot create the main window: {error}")))?;
    if background {
        // Windows may place a new window on a screen anyway: moved once built.
        window
            .set_position(tauri::PhysicalPosition::new(OFF_SCREEN, OFF_SCREEN))
            .map_err(|error| AppError::Internal(format!("cannot move the window: {error}")))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn without_extra_arguments_keeps_tauri_defaults() {
        assert_eq!(
            browser_args(None),
            "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection"
        );
        assert_eq!(browser_args(Some("   ")), browser_args(None));
    }

    #[test]
    fn merges_the_environment_arguments() {
        let extra = "--allow-pre-commit-input --disable-features=IgnoreDuplicateNavs,Prewarm \
                     --enable-logging --remote-debugging-port=0";
        assert_eq!(
            browser_args(Some(extra)),
            "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection,IgnoreDuplicateNavs,Prewarm \
             --allow-pre-commit-input --enable-logging --remote-debugging-port=0"
        );
    }

    #[test]
    fn does_not_repeat_features() {
        assert_eq!(
            browser_args(Some(
                "--disable-features=msPdfOOUI,,Prewarm --disable-features=Prewarm"
            )),
            "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection,Prewarm"
        );
    }
}
