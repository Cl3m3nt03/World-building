use std::path::Path;

/// Commands callable from the front. Tauri generates one `allow-<command>`
/// permission per entry; each must be granted in `capabilities/default.json`
/// (ADR 0001: one permission per command, nothing allowed by default).
const COMMANDS: &[&str] = &[
    "app_info",
    "default_worlds_dir",
    "import_asset",
    "import_asset_data",
    "list_assets",
    "rename_asset",
    "delete_asset",
    "asset_usages",
    "list_library_assets",
    "import_library_asset",
    "add_assets_to_library",
    "rename_library_asset",
    "remove_library_asset",
    "pick_library_asset",
    "library_storage",
    "world_storage",
    "set_world_storage_limit",
    "create_map",
    "get_map",
    "save_map",
    "set_map_background",
    "duplicate_map",
    "create_canvas",
    "get_canvas",
    "save_canvas",
    "duplicate_canvas",
    "create_graph",
    "get_graph",
    "save_graph",
    "duplicate_graph",
    "graph_data",
    "create_tree",
    "get_tree",
    "save_tree_variant",
    "add_tree_variant",
    "rename_tree_variant",
    "move_tree_variant",
    "delete_tree_variant",
    "duplicate_tree",
    "list_relation_types",
    "create_relation_type",
    "update_relation_type",
    "relation_type_uses",
    "delete_relation_type",
    "list_documents",
    "mark_document_opened",
    "recent_documents",
    "rename_document",
    "trash_document",
    "restore_document",
    "delete_document",
    "empty_trash",
    "search_documents",
    "list_card_types",
    "create_card_type",
    "update_card_type",
    "duplicate_card_type",
    "reorder_card_types",
    "delete_card_type",
    "create_card",
    "duplicate_card",
    "list_cards",
    "get_card",
    "set_card_type",
    "set_card_image",
    "set_card_aliases",
    "get_card_content",
    "set_card_content",
    "count_type_cards",
    "count_cards_by_type",
    "list_type_properties",
    "card_properties",
    "create_property",
    "rename_property",
    "set_property_kind",
    "set_property_relation",
    "apply_property_to_existing",
    "reorder_properties",
    "count_property_values",
    "delete_property",
    "set_property_value",
    "card_backlinks",
    "get_settings",
    "update_preferences",
    "set_default_worlds_dir",
    "remove_recent_world",
    "missing_recent_worlds",
    "relocate_recent_world",
    "reveal_in_explorer",
    "document_tree",
    "move_document",
    "create_folder",
    "update_folder",
    "move_folder",
    "delete_folder",
    "set_document_pinned",
    "move_pin",
    "get_sidebar_state",
    "set_sidebar_state",
    "create_world",
    "open_world",
    "close_world",
    "current_world",
    "update_world",
    "delete_world",
    "set_world_theme",
    "set_world_preferences",
    "finish_close",
    "set_world_main_image",
];

fn main() {
    embed_windows_manifest();

    let attributes = tauri_build::Attributes::new()
        .app_manifest(tauri_build::AppManifest::new().commands(COMMANDS))
        .windows_attributes(tauri_build::WindowsAttributes::new_without_app_manifest());
    if let Err(error) = tauri_build::try_build(attributes) {
        panic!("tauri build failed: {error:#}");
    }
}

/// Embeds the Windows application manifest (Common Controls v6) in every
/// linked target, test binaries included. Tauri's default embeds it in the
/// app binary only, so `cargo test` crashed with STATUS_ENTRYPOINT_NOT_FOUND.
fn embed_windows_manifest() {
    let manifest = Path::new("windows-app-manifest.xml");
    println!("cargo:rerun-if-changed={}", manifest.display());

    let is_windows_msvc = std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows")
        && std::env::var("CARGO_CFG_TARGET_ENV").as_deref() == Ok("msvc");
    if !is_windows_msvc {
        return;
    }

    let manifest = match manifest.canonicalize() {
        Ok(path) => path,
        Err(error) => panic!("windows-app-manifest.xml not found: {error}"),
    };
    println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
    println!("cargo:rustc-link-arg=/MANIFESTINPUT:{}", manifest.display());
}
