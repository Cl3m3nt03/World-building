mod commands;
mod db;
mod domain;
mod error;
mod logging;
mod paths;
mod protocol;
mod settings;
mod state;
mod thumbnails;
mod window;
mod world;

use tauri::Manager;
use tauri_specta::{Builder, collect_commands};

pub use error::{AppError, AppResult};

/// Path of the generated bindings, relative to `src-tauri/`.
pub const BINDINGS_PATH: &str = "../src/lib/bindings.ts";

/// Every command exposed to the front. The TypeScript bindings are generated
/// from this list (see the `export_bindings` test).
pub fn specta_builder() -> Builder<tauri::Wry> {
    Builder::<tauri::Wry>::new().commands(collect_commands![
        commands::app::app_info,
        commands::app::default_worlds_dir,
        commands::assets::import_asset,
        commands::assets::import_asset_data,
        commands::assets::list_assets,
        commands::assets::rename_asset,
        commands::assets::delete_asset,
        commands::settings::get_settings,
        commands::settings::update_preferences,
        commands::settings::set_default_worlds_dir,
        commands::world::create_world,
        commands::world::open_world,
        commands::world::close_world,
        commands::world::current_world,
        commands::world::update_world,
        commands::world::set_world_main_image,
    ])
}

/// Builds and runs the Tauri application.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() -> tauri::Result<()> {
    let builder = specta_builder();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(builder.invoke_handler())
        .register_asynchronous_uri_scheme_protocol(protocol::SCHEME, protocol::handle)
        .register_asynchronous_uri_scheme_protocol(thumbnails::SCHEME, protocol::handle_thumbnail)
        .setup(|app| {
            let log_dir = paths::log_dir(app.handle())?;
            let guard = logging::init(&log_dir)?;
            app.manage(guard);

            let config_dir = paths::config_dir(app.handle())?;
            let settings = settings::load(&config_dir);
            app.manage(state::AppState::new(config_dir, settings));
            window::create_main_window(app)?;
            tracing::info!(
                version = %app.package_info().version,
                log_dir = %log_dir.display(),
                "BuilderZ started"
            );
            // WebView2 settings injected through the environment (e.g. by
            // msedgedriver in the end-to-end tests), useful when a webview
            // does not start as expected.
            for (key, value) in std::env::vars().filter(|(key, _)| key.starts_with("WEBVIEW2_")) {
                tracing::debug!(%key, %value, "WebView2 environment");
            }
            Ok(())
        })
        .run(tauri::generate_context!())
}

#[cfg(test)]
mod tests {
    use specta_typescript::Typescript;

    use super::*;

    /// Regenerates `src/lib/bindings.ts`. Runs with `cargo test`, so CI fails
    /// when the committed file is out of date (`git diff --exit-code`).
    #[test]
    fn export_bindings() {
        specta_builder()
            .export(Typescript::default(), BINDINGS_PATH)
            .expect("failed to export TypeScript bindings");
    }
}
