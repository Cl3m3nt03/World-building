use std::path::Path;

use tauri::State;
use time::OffsetDateTime;
use time::format_description::well_known::Rfc3339;

use crate::db;
use crate::error::AppResult;
use crate::settings::{self, RecentWorld};
use crate::state::AppState;
use crate::world::{self, OpenWorld, WorldInfo};

/// Creates a world named `name` in a new folder inside `parent_dir` (the
/// folder is named after the world), and opens it.
#[tauri::command]
#[specta::specta]
pub async fn create_world(
    state: State<'_, AppState>,
    parent_dir: String,
    name: String,
) -> AppResult<WorldInfo> {
    let root = Path::new(&parent_dir).join(world::folder_name(&name)?);
    let world = world::create(&root, &name, &db::MIGRATOR).await?;
    Ok(activate(&state, world).await)
}

/// Opens the world in `path`, migrating it if needed. Closes the world that
/// was open, if any.
#[tauri::command]
#[specta::specta]
pub async fn open_world(state: State<'_, AppState>, path: String) -> AppResult<WorldInfo> {
    let world = world::open(Path::new(&path), &db::MIGRATOR).await?;
    Ok(activate(&state, world).await)
}

/// Closes the open world. Does nothing if no world is open.
#[tauri::command]
#[specta::specta]
pub async fn close_world(state: State<'_, AppState>) -> AppResult<()> {
    close(&state).await;
    Ok(())
}

/// The open world, if any.
#[tauri::command]
#[specta::specta]
pub async fn current_world(state: State<'_, AppState>) -> AppResult<Option<WorldInfo>> {
    Ok(state.world.lock().await.as_ref().map(OpenWorld::info))
}

/// Makes `world` the open world (closing the previous one) and records it in
/// the recent worlds. The new world is fully opened before the old one closes,
/// so a failed open never leaves the app without a world.
pub async fn activate(state: &AppState, world: OpenWorld) -> WorldInfo {
    let info = world.info();
    let previous = state.world.lock().await.replace(world);
    if let Some(previous) = previous {
        previous.close().await;
    }

    let mut settings = state.settings.lock().await;
    settings.record_recent_world(RecentWorld {
        path: info.path.clone(),
        name: info.name.clone(),
        last_opened_at: OffsetDateTime::now_utc()
            .format(&Rfc3339)
            .unwrap_or_default(),
    });
    if let Err(error) = settings::save(&state.config_dir, &settings) {
        // Not fatal: the world is open, only the recent list is not persisted.
        tracing::warn!(%error, "cannot save the recent worlds");
    }
    info
}

pub async fn close(state: &AppState) {
    let previous = state.world.lock().await.take();
    if let Some(previous) = previous {
        previous.close().await;
    }
}
