//! Queries of the graphs (migration 0011), and of what a graph draws: the
//! live cards and their links.

use sqlx::{Sqlite, SqlitePool, Transaction};

use crate::error::AppResult;

pub struct GraphRow {
    pub document_id: String,
    pub title: String,
    pub filters: String,
    pub settings: String,
    pub viewport: Option<String>,
}

pub struct PinnedRow {
    pub card_id: String,
    pub x: f64,
    pub y: f64,
}

pub struct NodeRow {
    pub id: String,
    pub title: String,
    pub type_id: Option<String>,
    pub image_asset_id: Option<String>,
    /// JSON list of the card's other names.
    pub aliases: String,
}

pub struct EdgeRow {
    pub source_id: String,
    pub target_id: String,
    pub count: i64,
}

pub async fn insert(
    tx: &mut Transaction<'_, Sqlite>,
    document_id: &str,
    filters: &str,
    settings: &str,
    viewport: Option<&str>,
) -> AppResult<()> {
    sqlx::query!(
        "INSERT INTO graphs (document_id, filters, settings, viewport) VALUES (?, ?, ?, ?)",
        document_id,
        filters,
        settings,
        viewport
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn get(pool: &SqlitePool, id: &str) -> AppResult<Option<GraphRow>> {
    Ok(sqlx::query_as!(
        GraphRow,
        r#"SELECT g.document_id AS "document_id!", d.title, g.filters, g.settings, g.viewport
           FROM graphs g JOIN documents d ON d.id = g.document_id
           WHERE g.document_id = ?"#,
        id
    )
    .fetch_optional(pool)
    .await?)
}

pub async fn pinned(pool: &SqlitePool, graph_id: &str) -> AppResult<Vec<PinnedRow>> {
    Ok(sqlx::query_as!(
        PinnedRow,
        r#"SELECT card_id AS "card_id!", x, y FROM graph_pinned_nodes
           WHERE graph_id = ? ORDER BY card_id"#,
        graph_id
    )
    .fetch_all(pool)
    .await?)
}

/// Replaces the graph's configuration (its pinned nodes included).
pub async fn update(
    tx: &mut Transaction<'_, Sqlite>,
    id: &str,
    filters: &str,
    settings: &str,
    viewport: Option<&str>,
) -> AppResult<bool> {
    let done = sqlx::query!(
        "UPDATE graphs SET filters = ?, settings = ?, viewport = ? WHERE document_id = ?",
        filters,
        settings,
        viewport,
        id
    )
    .execute(&mut **tx)
    .await?;
    sqlx::query!("DELETE FROM graph_pinned_nodes WHERE graph_id = ?", id)
        .execute(&mut **tx)
        .await?;
    Ok(done.rows_affected() > 0)
}

pub async fn insert_pinned(
    tx: &mut Transaction<'_, Sqlite>,
    graph_id: &str,
    pinned: &PinnedRow,
) -> AppResult<()> {
    sqlx::query!(
        "INSERT INTO graph_pinned_nodes (graph_id, card_id, x, y) VALUES (?, ?, ?, ?)",
        graph_id,
        pinned.card_id,
        pinned.x,
        pinned.y
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// The live cards, by title.
pub async fn nodes(pool: &SqlitePool) -> AppResult<Vec<NodeRow>> {
    Ok(sqlx::query_as!(
        NodeRow,
        r#"SELECT d.id AS "id!", d.title, c.type_id, c.image_asset_id, c.aliases
           FROM cards c JOIN documents d ON d.id = c.document_id
           WHERE d.trashed_at IS NULL
           ORDER BY d.title COLLATE NOCASE, d.created_at"#
    )
    .fetch_all(pool)
    .await?)
}

/// Links from a live card to another live card (mentions and link
/// properties), counted per ordered pair.
pub async fn edges(pool: &SqlitePool) -> AppResult<Vec<EdgeRow>> {
    Ok(sqlx::query_as!(
        EdgeRow,
        r#"SELECT l.source_id AS "source_id!", l.target_id AS "target_id!",
                  COUNT(*) AS "count!: i64"
           FROM links l
           JOIN cards cs ON cs.document_id = l.source_id
           JOIN documents ds ON ds.id = l.source_id AND ds.trashed_at IS NULL
           JOIN cards ct ON ct.document_id = l.target_id
           JOIN documents dt ON dt.id = l.target_id AND dt.trashed_at IS NULL
           WHERE l.kind IN ('mention', 'property') AND l.source_id <> l.target_id
           GROUP BY l.source_id, l.target_id"#
    )
    .fetch_all(pool)
    .await?)
}
