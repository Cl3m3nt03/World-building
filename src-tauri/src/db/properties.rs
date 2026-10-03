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
    /// A relation type, for a link property that is a relation.
    pub relation_type_id: Option<String>,
    pub applies_to_existing: i64,
    pub sort_order: i64,
    pub created_at: String,
}

pub async fn insert(pool: &SqlitePool, row: &DefinitionRow) -> AppResult<()> {
    sqlx::query!(
        "INSERT INTO property_definitions (id, type_id, card_id, label, kind, target_type_ids,
                                           relation_type_id, applies_to_existing, sort_order,
                                           created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        row.id,
        row.type_id,
        row.card_id,
        row.label,
        row.kind,
        row.target_type_ids,
        row.relation_type_id,
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
        "SELECT id, type_id, card_id, label, kind, target_type_ids, relation_type_id, applies_to_existing,
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
        "SELECT id, type_id, card_id, label, kind, target_type_ids, relation_type_id, applies_to_existing,
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
        "SELECT id, type_id, card_id, label, kind, target_type_ids, relation_type_id, applies_to_existing,
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

/// Sets the relation a link property carries (`None`: none).
pub async fn set_relation(
    pool: &SqlitePool,
    id: &str,
    relation_type_id: Option<&str>,
) -> AppResult<()> {
    sqlx::query!(
        "UPDATE property_definitions SET relation_type_id = ? WHERE id = ?",
        relation_type_id,
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

/// Ids of the properties that belong to the card itself (not to its type).
pub async fn own_definition_ids(
    tx: &mut Transaction<'_, Sqlite>,
    card_id: &str,
) -> AppResult<Vec<String>> {
    Ok(sqlx::query_scalar!(
        r#"SELECT id AS "id!" FROM property_definitions WHERE card_id = ? ORDER BY sort_order"#,
        card_id
    )
    .fetch_all(&mut **tx)
    .await?)
}

/// Copies the definition `from` as `id`, owned by the card `card_id`.
pub async fn copy_definition(
    tx: &mut Transaction<'_, Sqlite>,
    from: &str,
    id: &str,
    card_id: &str,
    created_at: &str,
) -> AppResult<()> {
    sqlx::query!(
        "INSERT INTO property_definitions (id, type_id, card_id, label, kind, target_type_ids,
                                           relation_type_id, applies_to_existing, sort_order,
                                           created_at)
         SELECT ?, NULL, ?, label, kind, target_type_ids, relation_type_id, applies_to_existing,
                sort_order, ?
         FROM property_definitions WHERE id = ?",
        id,
        card_id,
        created_at,
        from
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Copies every property value of the card `from` to the card `to`; values
/// of the properties in `renamed` (old id, new id) go to the new id.
pub async fn copy_values(
    tx: &mut Transaction<'_, Sqlite>,
    from: &str,
    to: &str,
    renamed: &[(String, String)],
) -> AppResult<()> {
    sqlx::query!(
        "INSERT INTO property_values (card_id, property_id, value)
         SELECT ?, property_id, value FROM property_values WHERE card_id = ?",
        to,
        from
    )
    .execute(&mut **tx)
    .await?;
    for (old, new) in renamed {
        sqlx::query!(
            "UPDATE property_values SET property_id = ? WHERE card_id = ? AND property_id = ?",
            new,
            to,
            old
        )
        .execute(&mut **tx)
        .await?;
    }
    Ok(())
}
