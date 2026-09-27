//! Queries on the `card_types` table, and on `meta` for the seeding flag.

use sqlx::{Sqlite, SqlitePool, Transaction};

use crate::error::AppResult;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CardTypeRow {
    pub id: String,
    pub parent_id: Option<String>,
    pub name: String,
    pub icon: String,
    pub color: String,
    pub guided_template: String,
    pub orientation: String,
    pub canvas_format: String,
    pub sort_order: i64,
    pub created_at: String,
}

pub async fn insert(tx: &mut Transaction<'_, Sqlite>, row: &CardTypeRow) -> AppResult<()> {
    sqlx::query!(
        "INSERT INTO card_types (id, parent_id, name, icon, color, guided_template,
                                 orientation, canvas_format, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        row.id,
        row.parent_id,
        row.name,
        row.icon,
        row.color,
        row.guided_template,
        row.orientation,
        row.canvas_format,
        row.sort_order,
        row.created_at,
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn get(pool: &SqlitePool, id: &str) -> AppResult<Option<CardTypeRow>> {
    Ok(sqlx::query_as!(
        CardTypeRow,
        "SELECT id, parent_id, name, icon, color, guided_template, orientation,
                canvas_format, sort_order, created_at
         FROM card_types WHERE id = ?",
        id
    )
    .fetch_optional(pool)
    .await?)
}

/// Every type and subtype: types in their order, each followed by nothing
/// in particular (the caller groups subtypes under their type).
pub async fn list(pool: &SqlitePool) -> AppResult<Vec<CardTypeRow>> {
    Ok(sqlx::query_as!(
        CardTypeRow,
        "SELECT id, parent_id, name, icon, color, guided_template, orientation,
                canvas_format, sort_order, created_at
         FROM card_types ORDER BY sort_order, created_at"
    )
    .fetch_all(pool)
    .await?)
}

/// Rows with the same parent as the given one (`None`: top-level types).
pub async fn siblings(pool: &SqlitePool, parent_id: Option<&str>) -> AppResult<Vec<CardTypeRow>> {
    Ok(sqlx::query_as!(
        CardTypeRow,
        "SELECT id, parent_id, name, icon, color, guided_template, orientation,
                canvas_format, sort_order, created_at
         FROM card_types WHERE parent_id IS ?
         ORDER BY sort_order, created_at",
        parent_id
    )
    .fetch_all(pool)
    .await?)
}

pub async fn update(pool: &SqlitePool, row: &CardTypeRow) -> AppResult<()> {
    sqlx::query!(
        "UPDATE card_types
         SET name = ?, icon = ?, color = ?, guided_template = ?, orientation = ?,
             canvas_format = ?
         WHERE id = ?",
        row.name,
        row.icon,
        row.color,
        row.guided_template,
        row.orientation,
        row.canvas_format,
        row.id,
    )
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn set_order(tx: &mut Transaction<'_, Sqlite>, id: &str, order: i64) -> AppResult<()> {
    sqlx::query!(
        "UPDATE card_types SET sort_order = ? WHERE id = ?",
        order,
        id
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Deletes a type; its subtypes go with it (foreign key cascade).
pub async fn delete(tx: &mut Transaction<'_, Sqlite>, id: &str) -> AppResult<bool> {
    let result = sqlx::query!("DELETE FROM card_types WHERE id = ?", id)
        .execute(&mut **tx)
        .await?;
    Ok(result.rows_affected() == 1)
}

/// Value of `key` in the world's `meta` table.
pub async fn meta(pool: &SqlitePool, key: &str) -> AppResult<Option<String>> {
    Ok(
        sqlx::query_scalar!("SELECT value FROM meta WHERE key = ?", key)
            .fetch_optional(pool)
            .await?,
    )
}

pub async fn set_meta(tx: &mut Transaction<'_, Sqlite>, key: &str, value: &str) -> AppResult<()> {
    sqlx::query!(
        "INSERT INTO meta (key, value) VALUES (?1, ?2)
         ON CONFLICT (key) DO UPDATE SET value = ?2",
        key,
        value
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}
