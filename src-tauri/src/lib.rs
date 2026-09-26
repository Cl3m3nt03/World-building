/// Builds and runs the Tauri application.
///
/// Commands, state and plugins are registered here as the milestones land.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() -> tauri::Result<()> {
    tauri::Builder::default().run(tauri::generate_context!())
}
