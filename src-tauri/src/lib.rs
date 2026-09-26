mod commands;
mod db;
mod error;
mod logging;
mod protocol;
mod settings;
mod state;
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
        commands::assets::import_asset,
        commands::settings::get_settings,
        commands::settings::update_preferences,
        commands::world::create_world,
        commands::world::open_world,
        commands::world::close_world,
        commands::world::current_world,
    ])
}

/// Builds and runs the Tauri application.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() -> tauri::Result<()> {
    let builder = specta_builder();

    tauri::Builder::default()
        .invoke_handler(builder.invoke_handler())
        .register_asynchronous_uri_scheme_protocol(protocol::SCHEME, protocol::handle)
        .setup(|app| {
            let log_dir = app.path().app_log_dir()?;
            let guard = logging::init(&log_dir)?;
            app.manage(guard);

            let config_dir = app.path().app_config_dir()?;
            let settings = settings::load(&config_dir);
            app.manage(state::AppState::new(config_dir, settings));
            tracing::info!(
                version = %app.package_info().version,
                log_dir = %log_dir.display(),
                "BuilderZ started"
            );
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
