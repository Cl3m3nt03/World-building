//! Queries of the canvases (migration 0014).

use sqlx::{Sqlite, SqlitePool, Transaction};

use crate::error::AppResult;

pub struct CanvasRow {
    pub document_id: String,
    pub title: String,
    pub scene: String,
    pub app_state: String,
}

pub struct CanvasUserRow {
    pub id: String,
    pub title: String,
    pub in_trash: bool,
}

pub async fn insert(
    tx: &mut Transaction<'_, Sqlite>,
    document_id: &str,
    scene: &str,
    app_state: &str,
) -> AppResult<()> {
    sqlx::query!(
        "INSERT INTO canvases (document_id, scene, app_state) VALUES (?, ?, ?)",
        document_id,
        scene,
        app_state
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn get(pool: &SqlitePool, id: &str) -> AppResult<Option<CanvasRow>> {
    Ok(sqlx::query_as!(
        CanvasRow,
        r#"SELECT c.document_id AS "document_id!", d.title, c.scene, c.app_state
           FROM canvases c JOIN documents d ON d.id = c.document_id
           WHERE c.document_id = ?"#,
        id
    )
    .fetch_optional(pool)
    .await?)
}

/// Replaces the scene and the state; false when there is no such canvas.
pub async fn update(
    tx: &mut Transaction<'_, Sqlite>,
    id: &str,
    scene: &str,
    app_state: &str,
) -> AppResult<bool> {
    let done = sqlx::query!(
        "UPDATE canvases SET scene = ?, app_state = ? WHERE document_id = ?",
        scene,
        app_state,
        id
    )
    .execute(&mut **tx)
    .await?;
    Ok(done.rows_affected() > 0)
}

/// Replaces the assets the canvas shows; ids that are not assets of the
/// world are left out (an image whose asset was deleted).
pub async fn set_assets(
    tx: &mut Transaction<'_, Sqlite>,
    canvas_id: &str,
    asset_ids: &[String],
) -> AppResult<()> {
    sqlx::query!("DELETE FROM canvas_assets WHERE canvas_id = ?", canvas_id)
        .execute(&mut **tx)
        .await?;
    for asset_id in asset_ids {
        sqlx::query!(
            "INSERT OR IGNORE INTO canvas_assets (canvas_id, asset_id)
             SELECT ?, id FROM assets WHERE id = ?",
            canvas_id,
            asset_id
        )
        .execute(&mut **tx)
        .await?;
    }
    Ok(())
}

/// The canvases showing the asset `asset_id`.
pub async fn using_asset(pool: &SqlitePool, asset_id: &str) -> AppResult<Vec<CanvasUserRow>> {
    Ok(sqlx::query_as!(
        CanvasUserRow,
        r#"SELECT d.id AS "id!", d.title, d.trashed_at IS NOT NULL AS "in_trash!: bool"
           FROM canvas_assets a JOIN documents d ON d.id = a.canvas_id
           WHERE a.asset_id = ?
           ORDER BY d.title COLLATE NOCASE"#,
        asset_id
    )
    .fetch_all(pool)
    .await?)
}
