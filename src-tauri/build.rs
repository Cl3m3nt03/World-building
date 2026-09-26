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
    "get_settings",
    "update_preferences",
    "set_default_worlds_dir",
    "remove_recent_world",
    "missing_recent_worlds",
    "relocate_recent_world",
    "reveal_in_explorer",
    "create_world",
    "open_world",
    "close_world",
    "current_world",
    "update_world",
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
