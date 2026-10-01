use std::path::{Path, PathBuf};

use sqlx::SqlitePool;
use tauri::State;

use crate::domain::media::{self, Asset, AssetFilter, AssetUsage, ImportedAsset};
use crate::error::{AppError, AppResult};
use crate::state::AppState;
use crate::world::storage;

/// Where an import lands: the open world's pool, `assets/` folder, folder
/// and storage limit, taken without holding the lock.
pub(crate) struct ImportTarget {
    pub pool: SqlitePool,
    pub assets_dir: PathBuf,
    root: PathBuf,
    limit: Option<u64>,
}

impl ImportTarget {
    pub(crate) async fn of_open_world(state: &AppState, command: &str) -> AppResult<Self> {
        let guard = state.world.lock().await;
        let world = guard
            .as_ref()
            .ok_or_else(|| AppError::NoWorldOpen(command.into()))?;
        Ok(Self {
            pool: world.pool.clone(),
            assets_dir: world.assets_dir(),
            root: world.root().to_path_buf(),
            limit: world.file.storage_limit,
        })
    }

    /// Refuses an import once the world has reached its storage limit (3.12).
    pub(crate) fn check_room(&self) -> AppResult<()> {
        storage::check_room(&self.root, self.limit)
    }

    /// After an import: a new file that took the world over its limit is
    /// removed again, and the import refused.
    pub(crate) async fn keep_within_limit(
        &self,
        imported: ImportedAsset,
    ) -> AppResult<ImportedAsset> {
        if !imported.created || !storage::is_over(&self.root, self.limit) {
            return Ok(imported);
        }
        media::delete(&self.pool, &self.assets_dir, &imported.asset.id).await?;
        Err(storage::limit_reached(self.limit.unwrap_or_default()))
    }
}

/// Pool and `assets/` folder of the open world, taken without holding the lock.
async fn open_world(state: &AppState, command: &str) -> AppResult<(SqlitePool, PathBuf)> {
    state
        .world
        .lock()
        .await
        .as_ref()
        .map(|world| (world.pool.clone(), world.assets_dir()))
        .ok_or_else(|| AppError::NoWorldOpen(command.into()))
}

/// Copies the file at `path` into the open world's media library, named by
/// its content hash. Importing the same content again returns the existing asset.
#[tauri::command]
#[specta::specta]
pub async fn import_asset(state: State<'_, AppState>, path: String) -> AppResult<ImportedAsset> {
    let target = ImportTarget::of_open_world(&state, "import_asset").await?;
    target.check_room()?;
    let imported = media::import(&target.pool, &target.assets_dir, Path::new(&path)).await?;
    target.keep_within_limit(imported).await
}

/// Imports raw content (an image pasted from the clipboard) under `name`.
#[tauri::command]
#[specta::specta]
pub async fn import_asset_data(
    state: State<'_, AppState>,
    name: String,
    data: Vec<u8>,
) -> AppResult<ImportedAsset> {
    let target = ImportTarget::of_open_world(&state, "import_asset_data").await?;
    target.check_room()?;
    let imported = media::import_bytes(&target.pool, &target.assets_dir, &name, data).await?;
    target.keep_within_limit(imported).await
}

/// Assets of the open world, newest first.
#[tauri::command]
#[specta::specta]
pub async fn list_assets(state: State<'_, AppState>, filter: AssetFilter) -> AppResult<Vec<Asset>> {
    let (pool, _) = open_world(&state, "list_assets").await?;
    let assets = media::list(&pool, &filter).await?;
    if filter.unused != Some(true) {
        return Ok(assets);
    }
    let world_uses: Vec<String> = {
        let guard = state.world.lock().await;
        guard
            .as_ref()
            .map(|world| {
                world
                    .file
                    .main_image
                    .iter()
                    .cloned()
                    .chain(world.file.theme.background().map(str::to_owned))
                    .collect()
            })
            .unwrap_or_default()
    };
    let mut unused = Vec::with_capacity(assets.len());
    for asset in assets {
        if !world_uses.contains(&asset.id) && media::card_usages(&pool, &asset.id).await?.is_empty()
        {
            unused.push(asset);
        }
    }
    Ok(unused)
}

/// Changes the name shown for an asset (its file keeps its hash name).
#[tauri::command]
#[specta::specta]
pub async fn rename_asset(
    state: State<'_, AppState>,
    id: String,
    name: String,
) -> AppResult<Asset> {
    let (pool, _) = open_world(&state, "rename_asset").await?;
    media::rename(&pool, &id, &name).await
}

/// Where an asset is used, to warn before deleting it.
#[tauri::command]
#[specta::specta]
pub async fn asset_usages(state: State<'_, AppState>, id: String) -> AppResult<Vec<AssetUsage>> {
    let (mut usages, pool) = {
        let guard = state.world.lock().await;
        let world = guard
            .as_ref()
            .ok_or_else(|| AppError::NoWorldOpen("asset_usages".into()))?;
        let mut usages = Vec::new();
        if world.file.main_image.as_deref() == Some(id.as_str()) {
            usages.push(AssetUsage::WorldMainImage {
                world_name: world.file.name.clone(),
            });
        }
        if world.file.theme.background() == Some(id.as_str()) {
            usages.push(AssetUsage::WorldTheme {
                world_name: world.file.name.clone(),
            });
        }
        (usages, world.pool.clone())
    };
    usages.extend(media::card_usages(&pool, &id).await?);
    Ok(usages)
}

/// Deletes an asset and its file. If it was the world's main image or theme
/// background, the world no longer uses it.
#[tauri::command]
#[specta::specta]
pub async fn delete_asset(state: State<'_, AppState>, id: String) -> AppResult<()> {
    let (pool, assets_dir) = open_world(&state, "delete_asset").await?;
    media::delete(&pool, &assets_dir, &id).await?;

    let cleared = {
        let mut guard = state.world.lock().await;
        match guard.as_mut() {
            Some(world) => world.forget_asset(&id)?.then(|| world.info()),
            None => None,
        }
    };

    // The main image is gone: so is the world's thumbnail in the world list.
    if let Some(info) = cleared {
        let thumbnail = super::world::sync_thumbnail(&state.config_dir, &info, true).await;
        let mut settings = state.settings.lock().await;
        settings.update_recent_world(&info.path, |recent| recent.thumbnail = thumbnail);
        if let Err(error) = crate::settings::save(&state.config_dir, &settings) {
            tracing::warn!(%error, "cannot save the recent worlds");
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn target(root: &Path, limit: Option<u64>) -> ImportTarget {
        let pool = crate::db::connect(&root.join("world.db"), true)
            .await
            .unwrap();
        crate::db::MIGRATOR.run(&pool).await.unwrap();
        ImportTarget {
            pool,
            assets_dir: root.join("assets"),
            root: root.to_path_buf(),
            limit,
        }
    }

    async fn import(target: &ImportTarget, path: &Path) -> AppResult<ImportedAsset> {
        target.check_room()?;
        let imported = media::import(&target.pool, &target.assets_dir, path).await?;
        target.keep_within_limit(imported).await
    }

    #[tokio::test]
    async fn an_import_beyond_the_limit_is_refused_and_leaves_nothing() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("world");
        std::fs::create_dir_all(&root).unwrap();
        let used = {
            let probe = target(&root, None).await;
            probe.pool.close().await;
            storage::usage(&root, "world.db", None).total as u64
        };
        let small = dir.path().join("small.png");
        std::fs::write(&small, vec![1; 1000]).unwrap();
        let big = dir.path().join("big.png");
        std::fs::write(&big, vec![2; 1_000_000]).unwrap();
        let target = target(&root, Some(used + 100_000)).await;

        let kept = import(&target, &small).await.unwrap();
        assert!(kept.created);

        let refused = import(&target, &big).await;
        assert!(matches!(refused, Err(AppError::StorageLimitReached(_))));
        let listed = media::list(&target.pool, &AssetFilter::default())
            .await
            .unwrap();
        assert_eq!(listed.len(), 1);
        assert_eq!(std::fs::read_dir(&target.assets_dir).unwrap().count(), 1);

        // The same content again takes no room: accepted.
        assert!(!import(&target, &small).await.unwrap().created);
    }
}
