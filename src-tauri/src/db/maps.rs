//! Queries of the maps (migration 0010). A map's content is written in one
//! transaction by `domain::maps::save`.

use sqlx::{Sqlite, SqlitePool, Transaction};

use crate::error::AppResult;

pub struct MapRow {
    pub document_id: String,
    pub title: String,
    pub background_asset_id: Option<String>,
    pub width: i64,
    pub height: i64,
    pub tiles_path: Option<String>,
}

pub struct LayerRow {
    pub id: String,
    pub name: String,
    pub visible: bool,
}

pub struct PinRow {
    pub id: String,
    pub layer_id: String,
    pub card_id: Option<String>,
    pub x: f64,
    pub y: f64,
    pub icon: String,
    pub color: String,
    pub label: String,
    pub size: f64,
}

pub struct ZoneRow {
    pub id: String,
    pub layer_id: String,
    pub points: String,
    pub label: String,
    pub label_style: String,
    pub card_id: Option<String>,
    pub fill_color: String,
    pub opacity: f64,
    pub pattern: String,
}

pub struct TextRow {
    pub id: String,
    pub layer_id: String,
    pub x: f64,
    pub y: f64,
    pub text: String,
    pub style: String,
}

pub async fn insert(
    tx: &mut Transaction<'_, Sqlite>,
    document_id: &str,
    background_asset_id: Option<&str>,
    width: i64,
    height: i64,
) -> AppResult<()> {
    sqlx::query!(
        "INSERT INTO maps (document_id, background_asset_id, width, height) VALUES (?, ?, ?, ?)",
        document_id,
        background_asset_id,
        width,
        height
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn get(pool: &SqlitePool, id: &str) -> AppResult<Option<MapRow>> {
    Ok(sqlx::query_as!(
        MapRow,
        r#"SELECT m.document_id AS "document_id!", d.title, m.background_asset_id,
                  m.width, m.height, m.tiles_path
           FROM maps m JOIN documents d ON d.id = m.document_id
           WHERE m.document_id = ?"#,
        id
    )
    .fetch_optional(pool)
    .await?)
}

pub async fn set_background(
    pool: &SqlitePool,
    id: &str,
    asset_id: &str,
    width: i64,
    height: i64,
) -> AppResult<bool> {
    let done = sqlx::query!(
        "UPDATE maps SET background_asset_id = ?, width = ?, height = ?, tiles_path = NULL
         WHERE document_id = ?",
        asset_id,
        width,
        height,
        id
    )
    .execute(pool)
    .await?;
    Ok(done.rows_affected() > 0)
}

/// Records where the map's tiles are (relative to the world), or none.
pub async fn set_tiles(pool: &SqlitePool, id: &str, tiles_path: Option<&str>) -> AppResult<()> {
    sqlx::query!(
        "UPDATE maps SET tiles_path = ? WHERE document_id = ?",
        tiles_path,
        id
    )
    .execute(pool)
    .await?;
    Ok(())
}

/// Ids of every map, trash included.
pub async fn ids(pool: &SqlitePool) -> AppResult<Vec<String>> {
    Ok(
        sqlx::query_scalar!(r#"SELECT document_id AS "id!" FROM maps"#)
            .fetch_all(pool)
            .await?,
    )
}

pub async fn layers(pool: &SqlitePool, map_id: &str) -> AppResult<Vec<LayerRow>> {
    Ok(sqlx::query_as!(
        LayerRow,
        r#"SELECT id AS "id!", name, visible AS "visible: bool"
           FROM map_layers WHERE map_id = ? ORDER BY sort_order"#,
        map_id
    )
    .fetch_all(pool)
    .await?)
}

pub async fn pins(pool: &SqlitePool, map_id: &str) -> AppResult<Vec<PinRow>> {
    Ok(sqlx::query_as!(
        PinRow,
        r#"SELECT id AS "id!", layer_id, card_id, x, y, icon, color, label, size
           FROM map_pins WHERE map_id = ? ORDER BY sort_order"#,
        map_id
    )
    .fetch_all(pool)
    .await?)
}

pub async fn zones(pool: &SqlitePool, map_id: &str) -> AppResult<Vec<ZoneRow>> {
    Ok(sqlx::query_as!(
        ZoneRow,
        r#"SELECT id AS "id!", layer_id, points, label, label_style, card_id, fill_color,
                  opacity, pattern
           FROM map_zones WHERE map_id = ? ORDER BY sort_order"#,
        map_id
    )
    .fetch_all(pool)
    .await?)
}

pub async fn texts(pool: &SqlitePool, map_id: &str) -> AppResult<Vec<TextRow>> {
    Ok(sqlx::query_as!(
        TextRow,
        r#"SELECT id AS "id!", layer_id, x, y, text, style
           FROM map_texts WHERE map_id = ? ORDER BY sort_order"#,
        map_id
    )
    .fetch_all(pool)
    .await?)
}

/// Removes the map's layers, and with them its pins, zones and texts.
pub async fn clear(tx: &mut Transaction<'_, Sqlite>, map_id: &str) -> AppResult<()> {
    sqlx::query!("DELETE FROM map_layers WHERE map_id = ?", map_id)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

pub async fn insert_layer(
    tx: &mut Transaction<'_, Sqlite>,
    map_id: &str,
    layer: &LayerRow,
    order: i64,
) -> AppResult<()> {
    sqlx::query!(
        "INSERT INTO map_layers (id, map_id, name, visible, sort_order) VALUES (?, ?, ?, ?, ?)",
        layer.id,
        map_id,
        layer.name,
        layer.visible,
        order
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn insert_pin(
    tx: &mut Transaction<'_, Sqlite>,
    map_id: &str,
    pin: &PinRow,
    order: i64,
) -> AppResult<()> {
    sqlx::query!(
        "INSERT INTO map_pins (id, map_id, layer_id, card_id, x, y, icon, color, label, size,
                               sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        pin.id,
        map_id,
        pin.layer_id,
        pin.card_id,
        pin.x,
        pin.y,
        pin.icon,
        pin.color,
        pin.label,
        pin.size,
        order
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn insert_zone(
    tx: &mut Transaction<'_, Sqlite>,
    map_id: &str,
    zone: &ZoneRow,
    order: i64,
) -> AppResult<()> {
    sqlx::query!(
        "INSERT INTO map_zones (id, map_id, layer_id, points, label, label_style, card_id,
                                fill_color, opacity, pattern, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        zone.id,
        map_id,
        zone.layer_id,
        zone.points,
        zone.label,
        zone.label_style,
        zone.card_id,
        zone.fill_color,
        zone.opacity,
        zone.pattern,
        order
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn insert_text(
    tx: &mut Transaction<'_, Sqlite>,
    map_id: &str,
    text: &TextRow,
    order: i64,
) -> AppResult<()> {
    sqlx::query!(
        "INSERT INTO map_texts (id, map_id, layer_id, x, y, text, style, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        text.id,
        map_id,
        text.layer_id,
        text.x,
        text.y,
        text.text,
        text.style,
        order
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub struct MapUserRow {
    pub id: String,
    pub title: String,
    pub in_trash: bool,
}

/// Maps (in the trash too) whose background is the asset, by title.
pub async fn using_asset(pool: &SqlitePool, asset_id: &str) -> AppResult<Vec<MapUserRow>> {
    Ok(sqlx::query_as!(
        MapUserRow,
        r#"SELECT d.id AS "id!", d.title, d.trashed_at IS NOT NULL AS "in_trash!: bool"
           FROM maps m JOIN documents d ON d.id = m.document_id
           WHERE m.background_asset_id = ?
           ORDER BY d.title COLLATE NOCASE"#,
        asset_id
    )
    .fetch_all(pool)
    .await?)
}

/// The asset was deleted: the maps on it no longer have a background.
pub async fn clear_background(pool: &SqlitePool, asset_id: &str) -> AppResult<()> {
    sqlx::query!(
        "UPDATE maps SET background_asset_id = NULL, tiles_path = NULL
         WHERE background_asset_id = ?",
        asset_id
    )
    .execute(pool)
    .await?;
    Ok(())
}
