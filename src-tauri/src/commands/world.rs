use std::path::{Path, PathBuf};

use tauri::State;
use time::OffsetDateTime;
use time::format_description::well_known::Rfc3339;

use crate::db;
use crate::domain::{card_types, media};
use crate::error::{AppError, AppResult};
use crate::settings::{self, AppSettings, RecentWorld};
use crate::state::AppState;
use crate::thumbnails;
use crate::world::{self, Genre, OpenWorld, WorldInfo, WorldPatch, WorldPreferences, WorldTheme};

/// Creates a world named `name`, of the given genre, in a new folder inside
/// `parent_dir` (the folder is named after the world), and opens it.
#[tauri::command]
#[specta::specta]
pub async fn create_world(
    state: State<'_, AppState>,
    parent_dir: String,
    name: String,
    genre: Genre,
) -> AppResult<WorldInfo> {
    let root = Path::new(&parent_dir).join(world::folder_name(&name)?);
    let world = world::create_with(&root, &name, genre, &db::MIGRATOR).await?;
    ensure_card_types(&state, &world).await;
    Ok(activate(&state, world).await)
}

/// Opens the world in `path`, migrating it if needed. Closes the world that
/// was open, if any.
#[tauri::command]
#[specta::specta]
pub async fn open_world(state: State<'_, AppState>, path: String) -> AppResult<WorldInfo> {
    let world = world::open(Path::new(&path), &db::MIGRATOR).await?;
    // Files imported before the media library existed (0.1.0) get their row.
    if let Err(error) = media::sync(&world.pool, &world.assets_dir()).await {
        tracing::warn!(%error, "cannot sync the media library");
    }
    // A world made before M2 gets the default types of its genre, once.
    ensure_card_types(&state, &world).await;
    Ok(activate(&state, world).await)
}

/// Creates the default card types of the world's genre, in the app language,
/// unless the world already got them. Not fatal: types can be made by hand.
async fn ensure_card_types(state: &AppState, world: &OpenWorld) {
    let language = state.settings.lock().await.preferences.language;
    if let Err(error) = card_types::ensure_defaults(&world.pool, world.info().genre, language).await
    {
        tracing::warn!(%error, "cannot create the default card types");
    }
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

/// Changes the name, genre or description of the open world.
#[tauri::command]
#[specta::specta]
pub async fn update_world(state: State<'_, AppState>, patch: WorldPatch) -> AppResult<WorldInfo> {
    let info = {
        let mut guard = state.world.lock().await;
        let world = guard
            .as_mut()
            .ok_or_else(|| AppError::NoWorldOpen("update_world".into()))?;
        world.update(patch)?;
        world.info()
    };

    let mut settings = state.settings.lock().await;
    settings.update_recent_world(&info.path, |recent| {
        info.name.clone_into(&mut recent.name);
        recent.genre = Some(info.genre);
    });
    if let Err(error) = settings::save(&state.config_dir, &settings) {
        tracing::warn!(%error, "cannot save the recent worlds");
    }
    Ok(info)
}

/// Sets (asset id) or clears (`null`) the main image of the open world.
#[tauri::command]
#[specta::specta]
pub async fn set_world_main_image(
    state: State<'_, AppState>,
    asset_id: Option<String>,
) -> AppResult<WorldInfo> {
    let info = {
        let mut guard = state.world.lock().await;
        let world = guard
            .as_mut()
            .ok_or_else(|| AppError::NoWorldOpen("set_world_main_image".into()))?;
        world.set_main_image(asset_id)?;
        world.info()
    };

    let thumbnail = sync_thumbnail(&state.config_dir, &info, true).await;
    let mut settings = state.settings.lock().await;
    settings.update_recent_world(&info.path, |recent| recent.thumbnail = thumbnail);
    if let Err(error) = settings::save(&state.config_dir, &settings) {
        tracing::warn!(%error, "cannot save the recent worlds");
    }
    Ok(info)
}

/// Sets the theme of the open world (a custom background must be in the
/// media library).
#[tauri::command]
#[specta::specta]
pub async fn set_world_theme(
    state: State<'_, AppState>,
    theme: WorldTheme,
) -> AppResult<WorldInfo> {
    let mut guard = state.world.lock().await;
    let world = guard
        .as_mut()
        .ok_or_else(|| AppError::NoWorldOpen("set_world_theme".into()))?;
    world.set_theme(theme)?;
    Ok(world.info())
}

/// Sets the writing preferences of the open world.
#[tauri::command]
#[specta::specta]
pub async fn set_world_preferences(
    state: State<'_, AppState>,
    preferences: WorldPreferences,
) -> AppResult<WorldInfo> {
    let mut guard = state.world.lock().await;
    let world = guard
        .as_mut()
        .ok_or_else(|| AppError::NoWorldOpen("set_world_preferences".into()))?;
    world.set_preferences(preferences)?;
    Ok(world.info())
}

/// Makes the cached thumbnail match the world's main image (regenerated when
/// `force`, else only if missing). Returns whether a thumbnail exists. A
/// failure only loses the thumbnail, never the world.
pub(crate) async fn sync_thumbnail(config_dir: &Path, info: &WorldInfo, force: bool) -> bool {
    let source: Option<PathBuf> = info
        .main_image
        .as_ref()
        .map(|id| Path::new(&info.path).join(world::ASSETS_DIR).join(id));
    let exists = thumbnails::path(config_dir, &info.id).is_ok_and(|path| path.is_file());
    if !force && source.is_some() == exists {
        return exists;
    }

    let (config_dir, id) = (config_dir.to_path_buf(), info.id.clone());
    let result = tauri::async_runtime::spawn_blocking(move || {
        thumbnails::refresh(&config_dir, &id, source.as_deref())
    })
    .await;
    match result {
        Ok(Ok(exists)) => exists,
        Ok(Err(error)) => {
            tracing::warn!(%error, world = %info.id, "cannot update the world thumbnail");
            false
        }
        Err(error) => {
            tracing::warn!(%error, "thumbnail task failed");
            false
        }
    }
}

/// Makes `world` the open world (closing the previous one) and records it in
/// the recent worlds. The new world is fully opened before the old one closes,
/// so a failed open never leaves the app without a world.
pub async fn activate(state: &AppState, world: OpenWorld) -> WorldInfo {
    let info = world.info();
    let thumbnail = sync_thumbnail(&state.config_dir, &info, false).await;
    let previous = state.world.lock().await.replace(world);
    if let Some(previous) = previous {
        previous.close().await;
    }

    let mut settings = state.settings.lock().await;
    settings.record_recent_world(RecentWorld {
        path: info.path.clone(),
        name: info.name.clone(),
        id: Some(info.id.clone()),
        genre: Some(info.genre),
        thumbnail,
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

/// Deletes the open world: it is closed, its folder goes to the Windows
/// recycle bin (it can be restored from there), and it leaves the recent
/// worlds. If the folder cannot be moved, the world is opened again and
/// nothing is lost. Returns the updated settings.
#[tauri::command]
#[specta::specta]
pub async fn delete_world(state: State<'_, AppState>) -> AppResult<AppSettings> {
    let world = state
        .world
        .lock()
        .await
        .take()
        .ok_or_else(|| AppError::NoWorldOpen("delete_world".into()))?;
    let info = world.info();
    let (root, id) = (world.root.clone(), world.file.id);
    // Closing releases the database files, which Windows would keep locked.
    world.close().await;

    let removal = {
        let root = root.clone();
        tauri::async_runtime::spawn_blocking(move || {
            world::remove_folder(&root, id, |path| {
                trash::delete(path).map_err(|error| AppError::Io(format!("recycle bin: {error}")))
            })
        })
        .await
        .map_err(|error| AppError::Internal(format!("delete task failed: {error}")))
        .and_then(|result| result)
    };
    if let Err(error) = removal {
        tracing::warn!(%error, path = %root.display(), "cannot delete the world");
        match world::open(&root, &db::MIGRATOR).await {
            Ok(reopened) => *state.world.lock().await = Some(reopened),
            Err(reopen) => tracing::warn!(error = %reopen, "cannot reopen the world"),
        }
        return Err(error);
    }
    tracing::info!(path = %root.display(), id = %id, "world moved to the recycle bin");

    if let Err(error) = thumbnails::refresh(&state.config_dir, &info.id, None) {
        tracing::warn!(%error, "cannot remove the world thumbnail");
    }
    let mut settings = state.settings.lock().await;
    let mut updated = settings.clone();
    updated.remove_recent_world(&info.path);
    if let Err(error) = settings::save(&state.config_dir, &updated) {
        // Not fatal: the list flags the missing folder on its own.
        tracing::warn!(%error, "cannot save the recent worlds");
    }
    *settings = updated.clone();
    Ok(updated)
}

pub async fn close(state: &AppState) {
    let previous = state.world.lock().await.take();
    if let Some(previous) = previous {
        previous.close().await;
    }
}
