//! Canvases (docs/features/06-canvas.md, M7): free whiteboards drawn with
//! Excalidraw by the front. The front holds the scene and sends it whole at
//! each save; this module checks it (JSON, bounded size, no image bytes)
//! and keeps the assets it shows, so the media library knows where an
//! image is used. Images are world assets: an image element's `fileId` is
//! the asset's id.

use std::collections::BTreeSet;

use serde::Serialize;
use serde_json::Value;
use specta::Type;
use sqlx::SqlitePool;

use crate::db;
use crate::db::canvases as queries;
use crate::domain::documents::{self, DocumentKind};
use crate::domain::tree;
use crate::error::{AppError, AppResult};

/// Largest scene, in bytes of JSON (images are not in it).
pub const MAX_SCENE_BYTES: usize = 8 * 1024 * 1024;
/// Largest kept state (framing, grid…), in bytes of JSON.
pub const MAX_APP_STATE_BYTES: usize = 64 * 1024;
/// Most elements in one scene.
pub const MAX_ELEMENTS: usize = 50_000;

/// An empty scene, and the state of a new canvas.
pub const EMPTY_SCENE: &str = r#"{"elements":[]}"#;
pub const EMPTY_APP_STATE: &str = "{}";

/// A canvas as seen by the front. The scene and the state are JSON texts,
/// read and written by Excalidraw.
#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Canvas {
    pub id: String,
    pub title: String,
    /// `{ "elements": [...] }`.
    pub scene: String,
    /// A JSON object: what of Excalidraw's state is kept (framing, grid…).
    pub app_state: String,
}

fn invalid(message: impl Into<String>) -> AppError {
    AppError::InvalidInput(message.into())
}

/// Checks a scene and a state sent by the front, and gives the assets the
/// scene shows (its image elements' `fileId`).
pub fn check(scene: &str, app_state: &str) -> AppResult<Vec<String>> {
    if scene.len() > MAX_SCENE_BYTES {
        return Err(invalid(format!(
            "a canvas scene holds at most {MAX_SCENE_BYTES} bytes"
        )));
    }
    if app_state.len() > MAX_APP_STATE_BYTES {
        return Err(invalid(format!(
            "a canvas state holds at most {MAX_APP_STATE_BYTES} bytes"
        )));
    }
    // Images are assets: their bytes never go in the database.
    if scene.contains("\"dataURL\"") || scene.contains("data:image/") {
        return Err(invalid(
            "a canvas scene keeps no image data, only asset ids",
        ));
    }
    let scene: Value =
        serde_json::from_str(scene).map_err(|error| invalid(format!("canvas scene: {error}")))?;
    let elements = scene
        .get("elements")
        .and_then(Value::as_array)
        .ok_or_else(|| invalid("a canvas scene is an object with its elements"))?;
    if elements.len() > MAX_ELEMENTS {
        return Err(invalid(format!(
            "a canvas holds at most {MAX_ELEMENTS} elements"
        )));
    }
    let state: Value = serde_json::from_str(app_state)
        .map_err(|error| invalid(format!("canvas state: {error}")))?;
    if !state.is_object() {
        return Err(invalid("a canvas state is an object"));
    }
    let mut assets = BTreeSet::new();
    for element in elements {
        if !element.is_object() {
            return Err(invalid("a canvas element is an object"));
        }
        let deleted = element.get("isDeleted").and_then(Value::as_bool) == Some(true);
        if element.get("type").and_then(Value::as_str) == Some("image")
            && !deleted
            && let Some(file) = element.get("fileId").and_then(Value::as_str)
        {
            if file.is_empty() || file.len() > 200 {
                return Err(invalid("an image element needs an asset id"));
            }
            assets.insert(file.to_owned());
        }
    }
    Ok(assets.into_iter().collect())
}

async fn insert_canvas(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    title: &str,
    scene: &str,
    app_state: &str,
    assets: &[String],
) -> AppResult<String> {
    let document = documents::create_in(tx, DocumentKind::Canvas, title).await?;
    queries::insert(tx, &document.id, scene, app_state).await?;
    queries::set_assets(tx, &document.id, assets).await?;
    Ok(document.id)
}

/// Creates an empty canvas named `title` (translated by the front).
pub async fn create(pool: &SqlitePool, title: &str) -> AppResult<Canvas> {
    let mut tx = db::begin_write(pool).await?;
    let id = insert_canvas(&mut tx, title, EMPTY_SCENE, EMPTY_APP_STATE, &[]).await?;
    tx.commit().await?;
    get(pool, &id).await
}

pub async fn get(pool: &SqlitePool, id: &str) -> AppResult<Canvas> {
    let row = queries::get(pool, id)
        .await?
        .ok_or_else(|| invalid(format!("canvas not found: {id}")))?;
    Ok(Canvas {
        id: row.document_id,
        title: row.title,
        scene: row.scene,
        app_state: row.app_state,
    })
}

/// Replaces the scene and the state of the canvas `id`, once checked.
pub async fn save(pool: &SqlitePool, id: &str, scene: &str, app_state: &str) -> AppResult<()> {
    let assets = check(scene, app_state)?;
    let mut tx = db::begin_write(pool).await?;
    if !queries::update(&mut tx, id, scene, app_state).await? {
        return Err(invalid(format!("canvas not found: {id}")));
    }
    queries::set_assets(&mut tx, id, &assets).await?;
    db::documents::touch(&mut tx, id, &documents::now()).await?;
    tx.commit().await?;
    Ok(())
}

/// Duplicates the canvas `id` as `title` (same scene), placed right after it.
pub async fn duplicate(pool: &SqlitePool, id: &str, title: &str) -> AppResult<Canvas> {
    let canvas = get(pool, id).await?;
    let assets = check(&canvas.scene, &canvas.app_state)?;
    let mut tx = db::begin_write(pool).await?;
    let copy = insert_canvas(&mut tx, title, &canvas.scene, &canvas.app_state, &assets).await?;
    tree::place_after(&mut tx, id, &copy).await?;
    tx.commit().await?;
    get(pool, &copy).await
}

#[cfg(test)]
mod tests;
