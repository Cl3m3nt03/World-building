//! Queries on the `links` table (mentions, link properties, map pins).

use sqlx::{Sqlite, SqlitePool, Transaction};

use crate::error::AppResult;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LinkRow {
    pub source_id: String,
    pub target_id: String,
    pub kind: String,
    pub detail: String,
}

/// Removes the links of `kind` from `source_id` (for one `detail`, or all of
/// them when `detail` is `None`).
pub async fn delete_from(
    tx: &mut Transaction<'_, Sqlite>,
    source_id: &str,
    kind: &str,
    detail: Option<&str>,
) -> AppResult<()> {
    sqlx::query!(
        "DELETE FROM links WHERE source_id = ?1 AND kind = ?2 AND (?3 IS NULL OR detail = ?3)",
        source_id,
        kind,
        detail
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn insert(tx: &mut Transaction<'_, Sqlite>, row: &LinkRow) -> AppResult<()> {
    sqlx::query!(
        "INSERT OR IGNORE INTO links (source_id, target_id, kind, detail) VALUES (?, ?, ?, ?)",
        row.source_id,
        row.target_id,
        row.kind,
        row.detail,
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Removes every link whose source is `source_id` (the source is deleted).
pub async fn delete_all_from(tx: &mut Transaction<'_, Sqlite>, source_id: &str) -> AppResult<()> {
    sqlx::query!("DELETE FROM links WHERE source_id = ?", source_id)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

/// Links pointing to `target_id`.
pub async fn to_target(pool: &SqlitePool, target_id: &str) -> AppResult<Vec<LinkRow>> {
    Ok(sqlx::query_as!(
        LinkRow,
        "SELECT source_id, target_id, kind, detail FROM links
         WHERE target_id = ? ORDER BY source_id, kind, detail",
        target_id
    )
    .fetch_all(pool)
    .await?)
}
