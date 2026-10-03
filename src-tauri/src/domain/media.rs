//! Media library: the files of a world's `assets/` folder and their
//! metadata in the `assets` table. Files are named by content hash
//! (`world::assets`); this module keeps the table in sync with them.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use specta::Type;
use sqlx::SqlitePool;
use time::OffsetDateTime;
use time::format_description::well_known::Rfc3339;

use crate::db::assets::{self as queries, AssetRow};
use crate::error::{AppError, AppResult};
use crate::world::assets as files;

/// Longest asset name, in characters.
pub const MAX_NAME_LEN: usize = 200;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum AssetKind {
    Image,
    Audio,
    Other,
}

impl AssetKind {
    fn from_mime(mime: &str) -> Self {
        if mime.starts_with("image/") {
            Self::Image
        } else if mime.starts_with("audio/") {
            Self::Audio
        } else {
            Self::Other
        }
    }

    fn as_str(self) -> &'static str {
        match self {
            Self::Image => "image",
            Self::Audio => "audio",
            Self::Other => "other",
        }
    }

    fn parse(value: &str) -> Self {
        match value {
            "image" => Self::Image,
            "audio" => Self::Audio,
            _ => Self::Other,
        }
    }
}

/// A file of the media library, as seen by the front.
#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Asset {
    /// `<sha256>.<ext>`: file name in `assets/`, used by `useAssetUrl`.
    pub id: String,
    pub name: String,
    pub kind: AssetKind,
    pub mime: String,
    /// Size in bytes (u64 has no safe JS type).
    pub size: f64,
    pub width: Option<u32>,
    pub height: Option<u32>,
    /// RFC 3339 import date.
    pub created_at: String,
}

impl From<AssetRow> for Asset {
    fn from(row: AssetRow) -> Self {
        Self {
            kind: AssetKind::parse(&row.kind),
            size: row.size as f64,
            width: row.width.and_then(|value| u32::try_from(value).ok()),
            height: row.height.and_then(|value| u32::try_from(value).ok()),
            id: row.id,
            name: row.name,
            mime: row.mime,
            created_at: row.created_at,
        }
    }
}

/// A place where an asset is used. Grows with the modules (cards, maps,
/// canvases…); in M1 only the world's main image uses assets.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum AssetUsage {
    /// The main image of the open world.
    WorldMainImage {
        #[serde(rename = "worldName")]
        world_name: String,
    },
    /// The background of the open world's custom theme.
    WorldTheme {
        #[serde(rename = "worldName")]
        world_name: String,
    },
    /// The image of a card.
    #[serde(rename_all = "camelCase")]
    CardImage {
        card_id: String,
        card_title: String,
        in_trash: bool,
    },
    /// In an image block of a card.
    #[serde(rename_all = "camelCase")]
    CardBlock {
        card_id: String,
        card_title: String,
        in_trash: bool,
    },
    /// The background of a map (M4).
    #[serde(rename_all = "camelCase")]
    MapBackground {
        map_id: String,
        map_title: String,
        in_trash: bool,
    },
    /// The banner of the wiki's home page (M8).
    WikiBanner,
    /// An image on a canvas (M7).
    #[serde(rename_all = "camelCase")]
    CanvasImage {
        canvas_id: String,
        canvas_title: String,
        in_trash: bool,
    },
}

/// Where an asset is used: map backgrounds, canvas images, card images and
/// image blocks (a card using it both ways is listed twice).
pub async fn card_usages(pool: &SqlitePool, id: &str) -> AppResult<Vec<AssetUsage>> {
    let mut usages = Vec::new();
    for row in crate::db::maps::using_asset(pool, id).await? {
        usages.push(AssetUsage::MapBackground {
            map_id: row.id,
            map_title: row.title,
            in_trash: row.in_trash,
        });
    }
    if crate::db::wiki::is_banner(pool, id).await? {
        usages.push(AssetUsage::WikiBanner);
    }
    for row in crate::db::canvases::using_asset(pool, id).await? {
        usages.push(AssetUsage::CanvasImage {
            canvas_id: row.id,
            canvas_title: row.title,
            in_trash: row.in_trash,
        });
    }
    for row in crate::db::cards::using_asset(pool, id).await? {
        if row.as_image {
            usages.push(AssetUsage::CardImage {
                card_id: row.id.clone(),
                card_title: row.title.clone(),
                in_trash: row.in_trash,
            });
        }
        if row.in_block {
            usages.push(AssetUsage::CardBlock {
                card_id: row.id,
                card_title: row.title,
                in_trash: row.in_trash,
            });
        }
    }
    Ok(usages)
}

/// Result of an import: the asset, and whether it is new to the world.
#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ImportedAsset {
    pub asset: Asset,
    /// False when the same content was already in the world.
    pub created: bool,
}

/// Filter of the media library; absent fields do not filter.
#[derive(Debug, Clone, Default, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct AssetFilter {
    pub kind: Option<AssetKind>,
    /// Fragment of the name.
    pub search: Option<String>,
    /// Only the assets used nowhere (3.12, to free space). Checked by the
    /// command, which knows the world's own uses (main image, theme).
    pub unused: Option<bool>,
}

fn now() -> String {
    OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .unwrap_or_default()
}

/// Metadata of the file `id` in `assets_dir`.
fn describe(assets_dir: &Path, id: &str, name: String) -> AppResult<AssetRow> {
    let path = files::resolve(assets_dir, id)?;
    let size = std::fs::metadata(&path)?.len();
    let mime = files::mime_type(id);
    let kind = AssetKind::from_mime(mime);
    let (width, height) = match kind {
        AssetKind::Image => match imagesize::size(&path) {
            Ok(size) => (
                i64::try_from(size.width).ok(),
                i64::try_from(size.height).ok(),
            ),
            Err(error) => {
                tracing::debug!(%error, %id, "image dimensions unreadable");
                (None, None)
            }
        },
        AssetKind::Audio | AssetKind::Other => (None, None),
    };
    Ok(AssetRow {
        id: id.to_owned(),
        name,
        kind: kind.as_str().to_owned(),
        mime: mime.to_owned(),
        size: i64::try_from(size).unwrap_or(i64::MAX),
        width,
        height,
        created_at: now(),
    })
}

fn validate_name(name: &str) -> AppResult<String> {
    let name = name.trim();
    if name.is_empty() {
        return Err(AppError::InvalidInput("asset name is empty".into()));
    }
    if name.chars().count() > MAX_NAME_LEN {
        return Err(AppError::InvalidInput(format!(
            "asset name longer than {MAX_NAME_LEN} characters"
        )));
    }
    Ok(name.to_owned())
}

/// Largest file accepted by `import_bytes` (pasted content), in bytes.
pub const MAX_PASTE_BYTES: usize = 50 * 1024 * 1024;

/// Copies `source` into `assets_dir` (named by hash) and records it. The same
/// content imported again returns the existing asset, with its current name.
pub async fn import(
    pool: &SqlitePool,
    assets_dir: &Path,
    source: &Path,
) -> AppResult<ImportedAsset> {
    import_named(pool, assets_dir, source, None).await
}

/// Imports raw content (e.g. an image pasted from the clipboard) under the
/// display name `name`, whose extension decides the file type.
pub async fn import_bytes(
    pool: &SqlitePool,
    assets_dir: &Path,
    name: &str,
    data: Vec<u8>,
) -> AppResult<ImportedAsset> {
    let name = validate_name(name)?;
    if data.is_empty() {
        return Err(AppError::InvalidInput("pasted content is empty".into()));
    }
    if data.len() > MAX_PASTE_BYTES {
        return Err(AppError::InvalidInput(format!(
            "pasted content larger than {MAX_PASTE_BYTES} bytes"
        )));
    }

    std::fs::create_dir_all(assets_dir)?;
    let extension = Path::new(&name)
        .extension()
        .and_then(|extension| extension.to_str())
        .filter(|extension| extension.bytes().all(|byte| byte.is_ascii_alphanumeric()))
        .unwrap_or("bin");
    // Not a valid asset id: ignored by `sync`, removed below in any case.
    let tmp = assets_dir.join(format!(".paste-{}.{extension}", uuid::Uuid::new_v4()));
    std::fs::write(&tmp, data)?;
    let result = import_named(pool, assets_dir, &tmp, Some(name)).await;
    if let Err(error) = std::fs::remove_file(&tmp) {
        tracing::warn!(%error, "cannot remove the temporary pasted file");
    }
    result
}

/// Imports `source` under `name` (its file name when `None`).
pub(crate) async fn import_named(
    pool: &SqlitePool,
    assets_dir: &Path,
    source: &Path,
    name: Option<String>,
) -> AppResult<ImportedAsset> {
    let (dir, path) = (assets_dir.to_path_buf(), source.to_path_buf());
    let file = tokio::task::spawn_blocking(move || files::import(&dir, &path))
        .await
        .map_err(|error| AppError::Internal(format!("import task failed: {error}")))??;

    let row = describe(
        assets_dir,
        &file.id,
        name.unwrap_or_else(|| file.original_name.clone()),
    )?;
    let created = queries::insert_if_absent(pool, &row).await?;
    let stored = queries::get(pool, &file.id)
        .await?
        .ok_or_else(|| AppError::Internal(format!("asset {} missing after import", file.id)))?;
    Ok(ImportedAsset {
        asset: stored.into(),
        created,
    })
}

/// Records the files of `assets_dir` that have no row yet (e.g. imported
/// before the media library existed). Returns how many were added.
pub async fn sync(pool: &SqlitePool, assets_dir: &Path) -> AppResult<usize> {
    if !assets_dir.is_dir() {
        return Ok(0);
    }
    let known: std::collections::HashSet<String> = queries::ids(pool).await?.into_iter().collect();
    let mut added = 0;
    for entry in std::fs::read_dir(assets_dir)? {
        let entry = entry?;
        let Some(id) = entry.file_name().to_str().map(str::to_owned) else {
            continue;
        };
        if !files::is_valid_id(&id) || known.contains(&id) || !entry.path().is_file() {
            continue;
        }
        let row = describe(assets_dir, &id, id.clone())?;
        if queries::insert_if_absent(pool, &row).await? {
            added += 1;
        }
    }
    if added > 0 {
        tracing::info!(added, "assets recorded from the assets folder");
    }
    Ok(added)
}

pub async fn list(pool: &SqlitePool, filter: &AssetFilter) -> AppResult<Vec<Asset>> {
    let kind = filter.kind.map(AssetKind::as_str);
    let search = filter
        .search
        .as_deref()
        .map(str::trim)
        .filter(|text| !text.is_empty());
    Ok(queries::list(pool, kind, search)
        .await?
        .into_iter()
        .map(Asset::from)
        .collect())
}

pub async fn rename(pool: &SqlitePool, id: &str, name: &str) -> AppResult<Asset> {
    let name = validate_name(name)?;
    if !queries::rename(pool, id, &name).await? {
        return Err(AppError::InvalidInput(format!("asset not found: {id}")));
    }
    let row = queries::get(pool, id)
        .await?
        .ok_or_else(|| AppError::Internal(format!("asset {id} missing after rename")))?;
    Ok(row.into())
}

/// Deletes the asset's row and file, and removes it from the cards that
/// used it as their image. The caller clears the world's main image.
pub async fn delete(pool: &SqlitePool, assets_dir: &Path, id: &str) -> AppResult<()> {
    let path: PathBuf = files::resolve(assets_dir, id)?;
    if !queries::delete(pool, id).await? {
        return Err(AppError::InvalidInput(format!("asset not found: {id}")));
    }
    crate::db::cards::clear_image(pool, id).await?;
    crate::db::maps::clear_background(pool, id).await?;
    match std::fs::remove_file(&path) {
        Ok(()) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => return Err(error.into()),
    }
    tracing::info!(%id, "asset deleted");
    Ok(())
}

#[cfg(test)]
mod tests;
