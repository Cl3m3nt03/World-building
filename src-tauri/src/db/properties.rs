//! Queries on `property_definitions` and `property_values`.

use sqlx::{Sqlite, SqlitePool, Transaction};

use crate::error::AppResult;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DefinitionRow {
    pub id: String,
    pub type_id: Option<String>,
    pub card_id: Option<String>,
    pub label: String,
    pub kind: String,
    pub target_type_ids: String,
    pub applies_to_existing: i64,
    pub sort_order: i64,
    pub created_at: String,
}

pub async fn insert(pool: &SqlitePool, row: &DefinitionRow) -> AppResult<()> {
    sqlx::query!(
        "INSERT INTO property_definitions (id, type_id, card_id, label, kind, target_type_ids,
                                           applies_to_existing, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        row.id,
        row.type_id,
        row.card_id,
        row.label,
        row.kind,
        row.target_type_ids,
        row.applies_to_existing,
        row.sort_order,
        row.created_at,
    )
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get(pool: &SqlitePool, id: &str) -> AppResult<Option<DefinitionRow>> {
    Ok(sqlx::query_as!(
        DefinitionRow,
        "SELECT id, type_id, card_id, label, kind, target_type_ids, applies_to_existing,
                sort_order, created_at
         FROM property_definitions WHERE id = ?",
        id
    )
    .fetch_optional(pool)
    .await?)
}

/// Properties defined on the type `type_id`, in order.
pub async fn of_type(pool: &SqlitePool, type_id: &str) -> AppResult<Vec<DefinitionRow>> {
    Ok(sqlx::query_as!(
        DefinitionRow,
        "SELECT id, type_id, card_id, label, kind, target_type_ids, applies_to_existing,
                sort_order, created_at
         FROM property_definitions WHERE type_id = ?
         ORDER BY sort_order, created_at",
        type_id
    )
    .fetch_all(pool)
    .await?)
}

/// Properties defined on the card `card_id` itself, in order.
pub async fn of_card(pool: &SqlitePool, card_id: &str) -> AppResult<Vec<DefinitionRow>> {
    Ok(sqlx::query_as!(
        DefinitionRow,
        "SELECT id, type_id, card_id, label, kind, target_type_ids, applies_to_existing,
                sort_order, created_at
         FROM property_definitions WHERE card_id = ?
         ORDER BY sort_order, created_at",
        card_id
    )
    .fetch_all(pool)
    .await?)
}

pub async fn set_label(pool: &SqlitePool, id: &str, label: &str) -> AppResult<()> {
    sqlx::query!(
        "UPDATE property_definitions SET label = ? WHERE id = ?",
        label,
        id
    )
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn set_kind(pool: &SqlitePool, id: &str, kind: &str, targets: &str) -> AppResult<()> {
    sqlx::query!(
        "UPDATE property_definitions SET kind = ?, target_type_ids = ? WHERE id = ?",
        kind,
        targets,
        id
    )
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn set_applies_to_existing(pool: &SqlitePool, id: &str) -> AppResult<()> {
    sqlx::query!(
        "UPDATE property_definitions SET applies_to_existing = 1 WHERE id = ?",
        id
    )
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn set_order(tx: &mut Transaction<'_, Sqlite>, id: &str, order: i64) -> AppResult<()> {
    sqlx::query!(
        "UPDATE property_definitions SET sort_order = ? WHERE id = ?",
        order,
        id
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Deletes a property; its values go with it (foreign key cascade).
pub async fn delete(pool: &SqlitePool, id: &str) -> AppResult<()> {
    sqlx::query!("DELETE FROM property_definitions WHERE id = ?", id)
        .execute(pool)
        .await?;
    Ok(())
}

/// Number of values a property has.
pub async fn count_values(pool: &SqlitePool, id: &str) -> AppResult<i64> {
    Ok(sqlx::query_scalar!(
        r#"SELECT COUNT(*) AS "count!: i64" FROM property_values WHERE property_id = ?"#,
        id
    )
    .fetch_one(pool)
    .await?)
}

/// Removes every value of a property (its kind changed).
pub async fn clear_values(pool: &SqlitePool, id: &str) -> AppResult<()> {
    sqlx::query!("DELETE FROM property_values WHERE property_id = ?", id)
        .execute(pool)
        .await?;
    Ok(())
}

/// Values of a card, by property id.
pub async fn values_of(pool: &SqlitePool, card_id: &str) -> AppResult<Vec<(String, String)>> {
    let rows = sqlx::query!(
        "SELECT property_id, value FROM property_values WHERE card_id = ?",
        card_id
    )
    .fetch_all(pool)
    .await?;
    Ok(rows
        .into_iter()
        .map(|row| (row.property_id, row.value))
        .collect())
}

pub async fn set_value(
    pool: &SqlitePool,
    card_id: &str,
    property_id: &str,
    value: &str,
) -> AppResult<()> {
    sqlx::query!(
        "INSERT INTO property_values (card_id, property_id, value) VALUES (?1, ?2, ?3)
         ON CONFLICT (card_id, property_id) DO UPDATE SET value = ?3",
        card_id,
        property_id,
        value
    )
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn clear_value(pool: &SqlitePool, card_id: &str, property_id: &str) -> AppResult<()> {
    sqlx::query!(
        "DELETE FROM property_values WHERE card_id = ? AND property_id = ?",
        card_id,
        property_id
    )
    .execute(pool)
    .await?;
    Ok(())
}
