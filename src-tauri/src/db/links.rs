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

/// Removes the links of `kind` made with `detail`, whatever their source
/// (a property is deleted).
pub async fn delete_by_detail(pool: &SqlitePool, kind: &str, detail: &str) -> AppResult<()> {
    sqlx::query!(
        "DELETE FROM links WHERE kind = ? AND detail = ?",
        kind,
        detail
    )
    .execute(pool)
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

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BacklinkRow {
    pub source_id: String,
    pub source_kind: String,
    pub source_title: String,
    pub source_type_id: Option<String>,
    pub link_kind: String,
    /// Label of the link property, for `property` links.
    pub property_label: Option<String>,
}

/// Links to `target_id` whose source is a live document (not in the trash,
/// not deleted), with what the backlinks show: the source's title and type,
/// and the property the link comes from.
pub async fn backlinks(pool: &SqlitePool, target_id: &str) -> AppResult<Vec<BacklinkRow>> {
    Ok(sqlx::query_as!(
        BacklinkRow,
        r#"SELECT l.source_id, d.kind AS source_kind, d.title AS source_title,
                  c.type_id AS source_type_id, l.kind AS link_kind,
                  p.label AS "property_label?"
           FROM links l
           JOIN documents d ON d.id = l.source_id AND d.trashed_at IS NULL
           LEFT JOIN cards c ON c.document_id = d.id
           LEFT JOIN property_definitions p ON l.kind = 'property' AND p.id = l.detail
           WHERE l.target_id = ?
           ORDER BY d.title COLLATE NOCASE, l.kind, p.label"#,
        target_id
    )
    .fetch_all(pool)
    .await?)
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

/// Copies every link made by `from` as links made by `to`; links whose
/// `detail` is in `renamed` (old, new) get the new detail.
pub async fn copy_from(
    tx: &mut Transaction<'_, Sqlite>,
    from: &str,
    to: &str,
    renamed: &[(String, String)],
) -> AppResult<()> {
    sqlx::query!(
        "INSERT OR IGNORE INTO links (source_id, target_id, kind, detail)
         SELECT ?, target_id, kind, detail FROM links WHERE source_id = ?",
        to,
        from
    )
    .execute(&mut **tx)
    .await?;
    for (old, new) in renamed {
        sqlx::query!(
            "UPDATE links SET detail = ? WHERE source_id = ? AND detail = ?",
            new,
            to,
            old
        )
        .execute(&mut **tx)
        .await?;
    }
    Ok(())
}
