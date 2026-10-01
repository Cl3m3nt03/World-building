//! The library shared by the worlds (ADR 0006, M3 step 3.13): images kept
//! outside any world, picked into a world by copying them there. It has the
//! format of a world's media library (files named by content hash in
//! `library/assets/`, their metadata in the `assets` table of
//! `library/library.db`), so the media library code serves it too.

use std::path::{Path, PathBuf};

use sqlx::SqlitePool;
use sqlx::migrate::Migrator;

use crate::db;
use crate::domain::media::{self, Asset, AssetFilter, ImportedAsset};
use crate::error::{AppError, AppResult};
use crate::world::assets as files;

/// Folder of the library, in the app config directory.
pub const LIBRARY_DIR: &str = "library";
const DATABASE_FILE: &str = "library.db";

/// Migrations of the library database, embedded in the binary.
pub static MIGRATOR: Migrator = sqlx::migrate!("./library-migrations");

/// The open library: its database and its `assets/` folder.
#[derive(Clone)]
pub struct Library {
    pub pool: SqlitePool,
    pub assets_dir: PathBuf,
}

/// `assets/` folder of the library under `config_dir`.
pub fn assets_dir(config_dir: &Path) -> PathBuf {
    config_dir.join(LIBRARY_DIR).join("assets")
}

/// Opens (creating it if needed) the library under `config_dir`, and
/// records the files of its folder that have no row yet.
pub async fn open(config_dir: &Path) -> AppResult<Library> {
    let dir = config_dir.join(LIBRARY_DIR);
    let assets_dir = assets_dir(config_dir);
    std::fs::create_dir_all(&assets_dir)?;
    let pool = db::connect(&dir.join(DATABASE_FILE), true).await?;
    MIGRATOR
        .run(&pool)
        .await
        .map_err(|error| AppError::Internal(format!("library migration failed: {error}")))?;
    media::sync(&pool, &assets_dir).await?;
    Ok(Library { pool, assets_dir })
}

impl Library {
    pub async fn list(&self, filter: &AssetFilter) -> AppResult<Vec<Asset>> {
        media::list(&self.pool, filter).await
    }

    /// Copies a file of the PC into the library.
    pub async fn import(&self, source: &Path) -> AppResult<ImportedAsset> {
        media::import(&self.pool, &self.assets_dir, source).await
    }

    /// Copies the asset `id` of a world (its file in `world_assets`) into the
    /// library, under `name`. Already there: kept with its library name.
    pub async fn add_from_world(
        &self,
        world_assets: &Path,
        id: &str,
        name: &str,
    ) -> AppResult<ImportedAsset> {
        let source = files::resolve(world_assets, id)?;
        media::import_named(&self.pool, &self.assets_dir, &source, Some(name.to_owned())).await
    }

    /// Copies the library asset `id` into a world's media library, under its
    /// library name. Already in the world: the world's asset is returned.
    pub async fn copy_into_world(
        &self,
        id: &str,
        world_pool: &SqlitePool,
        world_assets: &Path,
    ) -> AppResult<ImportedAsset> {
        let source = files::resolve(&self.assets_dir, id)?;
        let row = db::assets::get(&self.pool, id)
            .await?
            .ok_or_else(|| AppError::InvalidInput(format!("library asset not found: {id}")))?;
        media::import_named(world_pool, world_assets, &source, Some(row.name)).await
    }

    pub async fn rename(&self, id: &str, name: &str) -> AppResult<Asset> {
        media::rename(&self.pool, id, name).await
    }

    /// Removes an asset from the library; the worlds keep their copies.
    pub async fn remove(&self, id: &str) -> AppResult<()> {
        let path = files::resolve(&self.assets_dir, id)?;
        if !db::assets::delete(&self.pool, id).await? {
            return Err(AppError::InvalidInput(format!(
                "library asset not found: {id}"
            )));
        }
        match std::fs::remove_file(&path) {
            Ok(()) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => return Err(error.into()),
        }
        tracing::info!(%id, "asset removed from the library");
        Ok(())
    }
}

#[cfg(test)]
mod tests;
