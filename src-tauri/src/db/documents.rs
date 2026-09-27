//! Queries on the `documents` table (the base shared by every module).

use sqlx::{Sqlite, SqlitePool, Transaction};

use crate::error::AppResult;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DocumentRow {
    pub id: String,
    pub kind: String,
    pub title: String,
    pub created_at: String,
    pub updated_at: String,
    pub opened_at: Option<String>,
    pub trashed_at: Option<String>,
}

pub async fn insert(tx: &mut Transaction<'_, Sqlite>, row: &DocumentRow) -> AppResult<()> {
    sqlx::query!(
        "INSERT INTO documents (id, kind, title, created_at, updated_at, opened_at, trashed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
        row.id,
        row.kind,
        row.title,
        row.created_at,
        row.updated_at,
        row.opened_at,
        row.trashed_at,
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Sets the update date (the document's own data changed).
pub async fn touch(tx: &mut Transaction<'_, Sqlite>, id: &str, now: &str) -> AppResult<()> {
    sqlx::query!("UPDATE documents SET updated_at = ? WHERE id = ?", now, id)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

pub async fn get(pool: &SqlitePool, id: &str) -> AppResult<Option<DocumentRow>> {
    Ok(sqlx::query_as!(
        DocumentRow,
        "SELECT id, kind, title, created_at, updated_at, opened_at, trashed_at
         FROM documents WHERE id = ?",
        id
    )
    .fetch_optional(pool)
    .await?)
}

/// Documents in the trash (`trashed = true`) or out of it, optionally of one
/// kind, by title (case-insensitive for ASCII).
pub async fn list(
    pool: &SqlitePool,
    kind: Option<&str>,
    trashed: bool,
) -> AppResult<Vec<DocumentRow>> {
    Ok(sqlx::query_as!(
        DocumentRow,
        r#"SELECT id, kind, title, created_at, updated_at, opened_at, trashed_at
           FROM documents
           WHERE (?1 IS NULL OR kind = ?1)
             AND ((trashed_at IS NOT NULL) = ?2)
           ORDER BY title COLLATE NOCASE, created_at"#,
        kind,
        trashed,
    )
    .fetch_all(pool)
    .await?)
}

/// Sets the title and the update date. Returns whether the document exists.
pub async fn set_title(pool: &SqlitePool, id: &str, title: &str, now: &str) -> AppResult<bool> {
    let result = sqlx::query!(
        "UPDATE documents SET title = ?, updated_at = ? WHERE id = ?",
        title,
        now,
        id
    )
    .execute(pool)
    .await?;
    Ok(result.rows_affected() == 1)
}

/// Records that the document was opened now. Returns whether it exists.
pub async fn set_opened(pool: &SqlitePool, id: &str, now: &str) -> AppResult<bool> {
    let result = sqlx::query!("UPDATE documents SET opened_at = ? WHERE id = ?", now, id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() == 1)
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RecentRow {
    pub id: String,
    pub kind: String,
    pub title: String,
    pub opened_at: String,
    pub image_asset_id: Option<String>,
    pub type_id: Option<String>,
}

/// Live documents opened at least once, most recent first, with the image
/// and type of the cards among them.
pub async fn recent(pool: &SqlitePool, limit: i64) -> AppResult<Vec<RecentRow>> {
    Ok(sqlx::query_as!(
        RecentRow,
        r#"SELECT d.id AS "id!", d.kind, d.title, d.opened_at AS "opened_at!",
                  c.image_asset_id, c.type_id
           FROM documents d LEFT JOIN cards c ON c.document_id = d.id
           WHERE d.opened_at IS NOT NULL AND d.trashed_at IS NULL
           ORDER BY d.opened_at DESC
           LIMIT ?"#,
        limit
    )
    .fetch_all(pool)
    .await?)
}

/// Puts a document in the trash (`Some(date)`) or takes it out (`None`).
/// Returns whether the document exists.
pub async fn set_trashed(pool: &SqlitePool, id: &str, trashed_at: Option<&str>) -> AppResult<bool> {
    let result = sqlx::query!(
        "UPDATE documents SET trashed_at = ? WHERE id = ?",
        trashed_at,
        id
    )
    .execute(pool)
    .await?;
    Ok(result.rows_affected() == 1)
}

/// Ids of the documents in the trash.
pub async fn trashed_ids(pool: &SqlitePool) -> AppResult<Vec<String>> {
    Ok(
        sqlx::query_scalar!("SELECT id FROM documents WHERE trashed_at IS NOT NULL")
            .fetch_all(pool)
            .await?,
    )
}

/// Deletes a document row for good (its kind's rows go with it through their
/// foreign keys). Returns whether it existed.
pub async fn delete(tx: &mut Transaction<'_, Sqlite>, id: &str) -> AppResult<bool> {
    let result = sqlx::query!("DELETE FROM documents WHERE id = ?", id)
        .execute(&mut **tx)
        .await?;
    Ok(result.rows_affected() == 1)
}
