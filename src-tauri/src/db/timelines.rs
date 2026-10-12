//! Queries of the timelines (migration 0020).

use sqlx::{SqliteExecutor, SqlitePool};

use crate::error::AppResult;

pub struct TrackRow {
    pub id: String,
    pub timeline_id: String,
    pub name: String,
    pub color: String,
    pub sort_order: i64,
}

pub struct ItemRow {
    pub id: String,
    pub track_id: String,
    pub card_id: Option<String>,
    pub title: String,
    pub color: String,
    pub description: String,
    pub start_day: i64,
    pub end_day: Option<i64>,
    pub precision: String,
    pub created_at: String,
    pub updated_at: String,
}

pub async fn insert(ex: impl SqliteExecutor<'_>, document_id: &str) -> AppResult<()> {
    sqlx::query!(
        "INSERT INTO timelines (document_id) VALUES (?)",
        document_id
    )
    .execute(ex)
    .await?;
    Ok(())
}

/// The title of a timeline, if it exists (in the trash or not).
pub async fn title(ex: impl SqliteExecutor<'_>, id: &str) -> AppResult<Option<String>> {
    Ok(sqlx::query_scalar!(
        "SELECT d.title FROM timelines t JOIN documents d ON d.id = t.document_id
         WHERE t.document_id = ?",
        id
    )
    .fetch_optional(ex)
    .await?)
}

pub async fn tracks(ex: impl SqliteExecutor<'_>, timeline_id: &str) -> AppResult<Vec<TrackRow>> {
    Ok(sqlx::query_as!(
        TrackRow,
        "SELECT id, timeline_id, name, color, sort_order FROM timeline_tracks
         WHERE timeline_id = ? ORDER BY sort_order, id",
        timeline_id
    )
    .fetch_all(ex)
    .await?)
}

pub async fn track(ex: impl SqliteExecutor<'_>, id: &str) -> AppResult<Option<TrackRow>> {
    Ok(sqlx::query_as!(
        TrackRow,
        "SELECT id, timeline_id, name, color, sort_order FROM timeline_tracks WHERE id = ?",
        id
    )
    .fetch_optional(ex)
    .await?)
}

pub async fn insert_track(ex: impl SqliteExecutor<'_>, row: &TrackRow) -> AppResult<()> {
    sqlx::query!(
        "INSERT INTO timeline_tracks (id, timeline_id, name, color, sort_order) VALUES (?, ?, ?, ?, ?)",
        row.id,
        row.timeline_id,
        row.name,
        row.color,
        row.sort_order
    )
    .execute(ex)
    .await?;
    Ok(())
}

pub async fn update_track(
    ex: impl SqliteExecutor<'_>,
    id: &str,
    name: &str,
    color: &str,
) -> AppResult<()> {
    sqlx::query!(
        "UPDATE timeline_tracks SET name = ?, color = ? WHERE id = ?",
        name,
        color,
        id
    )
    .execute(ex)
    .await?;
    Ok(())
}

pub async fn set_track_order(ex: impl SqliteExecutor<'_>, id: &str, order: i64) -> AppResult<()> {
    sqlx::query!(
        "UPDATE timeline_tracks SET sort_order = ? WHERE id = ?",
        order,
        id
    )
    .execute(ex)
    .await?;
    Ok(())
}

pub async fn delete_track(ex: impl SqliteExecutor<'_>, id: &str) -> AppResult<()> {
    sqlx::query!("DELETE FROM timeline_tracks WHERE id = ?", id)
        .execute(ex)
        .await?;
    Ok(())
}

/// The items of a timeline, in time order.
pub async fn items(ex: impl SqliteExecutor<'_>, timeline_id: &str) -> AppResult<Vec<ItemRow>> {
    Ok(sqlx::query_as!(
        ItemRow,
        r#"SELECT i.id AS "id!", i.track_id, i.card_id, i.title, i.color, i.description,
                  i.start_day, i.end_day, i.precision, i.created_at, i.updated_at
           FROM timeline_items i JOIN timeline_tracks t ON t.id = i.track_id
           WHERE t.timeline_id = ? ORDER BY i.start_day, i.id"#,
        timeline_id
    )
    .fetch_all(ex)
    .await?)
}

pub async fn item(ex: impl SqliteExecutor<'_>, id: &str) -> AppResult<Option<ItemRow>> {
    Ok(sqlx::query_as!(
        ItemRow,
        "SELECT id, track_id, card_id, title, color, description, start_day, end_day, precision,
                created_at, updated_at
         FROM timeline_items WHERE id = ?",
        id
    )
    .fetch_optional(ex)
    .await?)
}

/// Inserts the item, or replaces the one with the same id.
pub async fn upsert_item(ex: impl SqliteExecutor<'_>, row: &ItemRow) -> AppResult<()> {
    sqlx::query!(
        "INSERT INTO timeline_items (id, track_id, card_id, title, color, description,
                                     start_day, end_day, precision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
            track_id = excluded.track_id, card_id = excluded.card_id, title = excluded.title,
            color = excluded.color, description = excluded.description,
            start_day = excluded.start_day, end_day = excluded.end_day,
            precision = excluded.precision, updated_at = excluded.updated_at",
        row.id,
        row.track_id,
        row.card_id,
        row.title,
        row.color,
        row.description,
        row.start_day,
        row.end_day,
        row.precision,
        row.created_at,
        row.updated_at
    )
    .execute(ex)
    .await?;
    Ok(())
}

pub async fn delete_item(ex: impl SqliteExecutor<'_>, id: &str) -> AppResult<bool> {
    let done = sqlx::query!("DELETE FROM timeline_items WHERE id = ?", id)
        .execute(ex)
        .await?;
    Ok(done.rows_affected() > 0)
}

/// Whether `id` is a card of the world (in the trash or not).
pub async fn is_card(pool: &SqlitePool, id: &str) -> AppResult<bool> {
    Ok(sqlx::query_scalar!(
        "SELECT COUNT(*) FROM documents WHERE id = ? AND kind = 'card'",
        id
    )
    .fetch_one(pool)
    .await?
        > 0)
}
