mod closing;
mod commands;
mod db;
mod domain;
mod error;
mod library;
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
        commands::assets::asset_usages,
        commands::library::list_library_assets,
        commands::library::import_library_asset,
        commands::library::add_assets_to_library,
        commands::library::rename_library_asset,
        commands::library::remove_library_asset,
        commands::library::pick_library_asset,
        commands::library::library_storage,
        commands::documents::list_documents,
        commands::documents::mark_document_opened,
        commands::documents::recent_documents,
        commands::documents::rename_document,
        commands::documents::trash_document,
        commands::documents::restore_document,
        commands::documents::delete_document,
        commands::documents::empty_trash,
        commands::documents::search_documents,
        commands::card_types::list_card_types,
        commands::card_types::create_card_type,
        commands::card_types::update_card_type,
        commands::card_types::duplicate_card_type,
        commands::card_types::reorder_card_types,
        commands::card_types::delete_card_type,
        commands::cards::create_card,
        commands::cards::duplicate_card,
        commands::cards::list_cards,
        commands::cards::get_card,
        commands::cards::set_card_type,
        commands::cards::set_card_image,
        commands::cards::set_card_aliases,
        commands::cards::get_card_content,
        commands::cards::set_card_content,
        commands::cards::count_type_cards,
        commands::cards::count_cards_by_type,
        commands::properties::list_type_properties,
        commands::properties::card_properties,
        commands::properties::create_property,
        commands::properties::rename_property,
        commands::properties::set_property_kind,
        commands::properties::apply_property_to_existing,
        commands::properties::reorder_properties,
        commands::properties::count_property_values,
        commands::properties::delete_property,
        commands::properties::set_property_value,
        commands::links::card_backlinks,
        commands::maps::create_map,
        commands::maps::get_map,
        commands::maps::save_map,
        commands::maps::set_map_background,
        commands::maps::duplicate_map,
        commands::settings::get_settings,
        commands::settings::update_preferences,
        commands::settings::set_default_worlds_dir,
        commands::settings::remove_recent_world,
        commands::settings::missing_recent_worlds,
        commands::settings::relocate_recent_world,
        commands::settings::reveal_in_explorer,
        commands::tree::document_tree,
        commands::tree::move_document,
        commands::tree::create_folder,
        commands::tree::update_folder,
        commands::tree::move_folder,
        commands::tree::delete_folder,
        commands::tree::set_document_pinned,
        commands::tree::move_pin,
        commands::tree::get_sidebar_state,
        commands::tree::set_sidebar_state,
        commands::world::create_world,
        commands::world::open_world,
        commands::world::close_world,
        commands::world::current_world,
        commands::world::update_world,
        commands::world::delete_world,
        commands::world::set_world_theme,
        commands::world::set_world_preferences,
        commands::world::world_storage,
        commands::world::set_world_storage_limit,
        closing::finish_close,
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
        .register_asynchronous_uri_scheme_protocol(
            protocol::LIBRARY_SCHEME,
            protocol::handle_library,
        )
        .manage(closing::Closing::default())
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let closing = window.state::<closing::Closing>();
                closing::on_close_requested(window, &closing, api);
            }
        })
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
