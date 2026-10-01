//! Queries on the `search` full text index (migration 0008).

use sqlx::SqlitePool;

use crate::error::AppResult;

/// A document matching a search, with its name and aliases highlighted
/// (see `domain::search::MARK_START` / `MARK_END`) and an excerpt of its
/// content.
#[derive(Debug, Clone, PartialEq, sqlx::FromRow)]
pub struct HitRow {
    pub id: String,
    pub kind: String,
    pub title_marked: String,
    pub aliases_marked: String,
    pub excerpt: String,
    pub type_id: Option<String>,
    pub image_asset_id: Option<String>,
}

/// Live documents whose index matches the FTS5 `expression`, best first.
///
/// The one query not written with `query_as!`: describing it at compile
/// time crashes the compiler (sqlx and the FTS5 virtual table). Its columns
/// are checked by `domain::search`'s tests instead.
pub async fn matching(
    pool: &SqlitePool,
    expression: &str,
    mark_start: &str,
    mark_end: &str,
    limit: i64,
) -> AppResult<Vec<HitRow>> {
    Ok(sqlx::query_as::<_, HitRow>(
        "SELECT s.document_id AS id, d.kind,
                highlight(search, 1, ?2, ?3) AS title_marked,
                highlight(search, 2, ?2, ?3) AS aliases_marked,
                snippet(search, 3, ?2, ?3, '…', 12) AS excerpt,
                c.type_id, c.image_asset_id
         FROM search AS s
         JOIN documents AS d ON d.id = s.document_id
         LEFT JOIN cards AS c ON c.document_id = d.id
         WHERE search MATCH ?1 AND d.trashed_at IS NULL
         ORDER BY bm25(search, 0.0, 10.0, 5.0, 1.0)
         LIMIT ?4",
    )
    .bind(expression)
    .bind(mark_start)
    .bind(mark_end)
    .bind(limit)
    .fetch_all(pool)
    .await?)
}
