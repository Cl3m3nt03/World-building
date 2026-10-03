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
    /// `mention` or `property`.
    pub kind: String,
    /// The property's name, for a link property (if it still exists).
    pub label: Option<String>,
    pub count: i64,
}

/// A card shown by a node of a live tree.
pub struct TreeNodeRow {
    pub id: String,
    pub card_id: String,
}

/// A link of a live tree, with its tree.
pub struct TreeEdgeRow {
    pub id: String,
    pub tree_id: String,
    pub tree_title: String,
    pub source_node_id: Option<String>,
    pub source_edge_id: Option<String>,
    pub target_node_id: String,
    pub relation_type_id: Option<String>,
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
/// properties), counted per ordered pair, kind and property.
pub async fn edges(pool: &SqlitePool) -> AppResult<Vec<EdgeRow>> {
    Ok(sqlx::query_as!(
        EdgeRow,
        r#"SELECT l.source_id AS "source_id!", l.target_id AS "target_id!", l.kind AS "kind!",
                  p.label AS "label?", COUNT(*) AS "count!: i64"
           FROM links l
           JOIN cards cs ON cs.document_id = l.source_id
           JOIN documents ds ON ds.id = l.source_id AND ds.trashed_at IS NULL
           JOIN cards ct ON ct.document_id = l.target_id
           JOIN documents dt ON dt.id = l.target_id AND dt.trashed_at IS NULL
           LEFT JOIN property_definitions p ON l.kind = 'property' AND p.id = l.detail
           WHERE l.kind IN ('mention', 'property') AND l.source_id <> l.target_id
           GROUP BY l.source_id, l.target_id, l.kind, l.detail
           ORDER BY l.source_id, l.target_id, l.kind, p.label"#
    )
    .fetch_all(pool)
    .await?)
}

/// The nodes of the live trees that show a card.
pub async fn tree_nodes(pool: &SqlitePool) -> AppResult<Vec<TreeNodeRow>> {
    Ok(sqlx::query_as!(
        TreeNodeRow,
        r#"SELECT n.id AS "id!", n.card_id AS "card_id!"
           FROM tree_nodes n
           JOIN tree_variants v ON v.id = n.variant_id
           JOIN documents d ON d.id = v.tree_id AND d.trashed_at IS NULL
           WHERE n.card_id IS NOT NULL"#
    )
    .fetch_all(pool)
    .await?)
}

/// The links of the live trees, tree by tree (by title) in their order.
pub async fn tree_edges(pool: &SqlitePool) -> AppResult<Vec<TreeEdgeRow>> {
    Ok(sqlx::query_as!(
        TreeEdgeRow,
        r#"SELECT e.id AS "id!", v.tree_id AS "tree_id!", d.title AS "tree_title!",
                  e.source_node_id, e.source_edge_id, e.target_node_id AS "target_node_id!",
                  e.relation_type_id
           FROM tree_edges e
           JOIN tree_variants v ON v.id = e.variant_id
           JOIN documents d ON d.id = v.tree_id AND d.trashed_at IS NULL
           ORDER BY d.title COLLATE NOCASE, d.id, v.sort_order, e.sort_order"#
    )
    .fetch_all(pool)
    .await?)
}
