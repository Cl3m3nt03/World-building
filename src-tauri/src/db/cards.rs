//! Queries on the `cards` table (joined with `documents` for reading).

use sqlx::{Sqlite, SqlitePool, Transaction};

use crate::error::AppResult;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CardRow {
    pub id: String,
    pub title: String,
    pub type_id: Option<String>,
    pub image_asset_id: Option<String>,
    pub aliases: String,
    pub created_at: String,
    pub updated_at: String,
    pub trashed_at: Option<String>,
}

pub async fn insert(
    tx: &mut Transaction<'_, Sqlite>,
    document_id: &str,
    type_id: &str,
) -> AppResult<()> {
    sqlx::query!(
        "INSERT INTO cards (document_id, type_id) VALUES (?, ?)",
        document_id,
        type_id
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn get(pool: &SqlitePool, id: &str) -> AppResult<Option<CardRow>> {
    Ok(sqlx::query_as!(
        CardRow,
        r#"SELECT d.id AS "id!", d.title, c.type_id, c.image_asset_id, c.aliases,
                  d.created_at, d.updated_at, d.trashed_at
           FROM cards c JOIN documents d ON d.id = c.document_id
           WHERE c.document_id = ?"#,
        id
    )
    .fetch_optional(pool)
    .await?)
}

pub async fn set_type(tx: &mut Transaction<'_, Sqlite>, id: &str, type_id: &str) -> AppResult<()> {
    sqlx::query!(
        "UPDATE cards SET type_id = ? WHERE document_id = ?",
        type_id,
        id
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn set_image(
    tx: &mut Transaction<'_, Sqlite>,
    id: &str,
    asset_id: Option<&str>,
) -> AppResult<()> {
    sqlx::query!(
        "UPDATE cards SET image_asset_id = ? WHERE document_id = ?",
        asset_id,
        id
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn set_aliases(
    tx: &mut Transaction<'_, Sqlite>,
    id: &str,
    aliases: &str,
) -> AppResult<()> {
    sqlx::query!(
        "UPDATE cards SET aliases = ? WHERE document_id = ?",
        aliases,
        id
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Cards in the trash (`trashed = true`) or out of it, by title
/// (case-insensitive for ASCII).
pub async fn list(pool: &SqlitePool, trashed: bool) -> AppResult<Vec<CardRow>> {
    Ok(sqlx::query_as!(
        CardRow,
        r#"SELECT d.id AS "id!", d.title, c.type_id, c.image_asset_id, c.aliases,
                  d.created_at, d.updated_at, d.trashed_at
           FROM cards c JOIN documents d ON d.id = c.document_id
           WHERE (d.trashed_at IS NOT NULL) = ?
           ORDER BY d.title COLLATE NOCASE, d.created_at"#,
        trashed
    )
    .fetch_all(pool)
    .await?)
}

/// Number of cards (in the trash or not) of the type `type_id` or of its subtypes.
pub async fn count_of_type(pool: &SqlitePool, type_id: &str) -> AppResult<i64> {
    Ok(sqlx::query_scalar!(
        r#"SELECT COUNT(*) AS "count!: i64" FROM cards
           WHERE type_id = ?1
              OR type_id IN (SELECT id FROM card_types WHERE parent_id = ?1)"#,
        type_id
    )
    .fetch_one(pool)
    .await?)
}

/// Number of live cards per type (or subtype) id.
pub async fn count_by_type(pool: &SqlitePool) -> AppResult<Vec<(String, i64)>> {
    let rows = sqlx::query!(
        r#"SELECT c.type_id AS "type_id!", COUNT(*) AS "count!: i64"
           FROM cards c JOIN documents d ON d.id = c.document_id
           WHERE d.trashed_at IS NULL AND c.type_id IS NOT NULL
           GROUP BY c.type_id"#
    )
    .fetch_all(pool)
    .await?;
    Ok(rows
        .into_iter()
        .map(|row| (row.type_id, row.count))
        .collect())
}

/// Moves the cards of the type `from` and of its subtypes to the type `to`.
pub async fn move_type(tx: &mut Transaction<'_, Sqlite>, from: &str, to: &str) -> AppResult<()> {
    sqlx::query!(
        "UPDATE cards SET type_id = ?2
         WHERE type_id = ?1 OR type_id IN (SELECT id FROM card_types WHERE parent_id = ?1)",
        from,
        to
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Removes an asset from the cards that use it as their image.
pub async fn clear_image(pool: &SqlitePool, asset_id: &str) -> AppResult<()> {
    sqlx::query!(
        "UPDATE cards SET image_asset_id = NULL WHERE image_asset_id = ?",
        asset_id
    )
    .execute(pool)
    .await?;
    Ok(())
}
