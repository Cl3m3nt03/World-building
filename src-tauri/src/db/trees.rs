//! Queries of the relation trees (migration 0012). A variant's content is
//! written in one transaction by `domain::trees::save_variant`.

use sqlx::{Sqlite, SqlitePool, Transaction};

use crate::error::AppResult;

pub struct RelationTypeRow {
    pub id: String,
    pub builtin: Option<String>,
    pub name: String,
    pub icon: String,
    pub inverse_id: Option<String>,
    pub category: String,
}

pub struct VariantRow {
    pub id: String,
    pub name: String,
}

pub struct NodeRow {
    pub id: String,
    pub card_id: Option<String>,
    pub label: String,
    pub x: f64,
    pub y: f64,
}

pub struct EdgeRow {
    pub id: String,
    pub source_node_id: Option<String>,
    pub source_edge_id: Option<String>,
    pub target_node_id: String,
    pub relation_type_id: Option<String>,
    pub line_style: String,
}

pub struct AnnotationRow {
    pub id: String,
    pub data: String,
}

// --- Relation types --------------------------------------------------------

pub async fn relation_types(pool: &SqlitePool) -> AppResult<Vec<RelationTypeRow>> {
    Ok(sqlx::query_as!(
        RelationTypeRow,
        r#"SELECT id AS "id!", builtin, name, icon, inverse_id, category
           FROM relation_types ORDER BY sort_order, name COLLATE NOCASE"#
    )
    .fetch_all(pool)
    .await?)
}

pub async fn relation_type(pool: &SqlitePool, id: &str) -> AppResult<Option<RelationTypeRow>> {
    Ok(sqlx::query_as!(
        RelationTypeRow,
        r#"SELECT id AS "id!", builtin, name, icon, inverse_id, category
           FROM relation_types WHERE id = ?"#,
        id
    )
    .fetch_optional(pool)
    .await?)
}

pub async fn insert_relation_type(
    tx: &mut Transaction<'_, Sqlite>,
    row: &RelationTypeRow,
) -> AppResult<()> {
    sqlx::query!(
        "INSERT INTO relation_types (id, builtin, name, icon, inverse_id, category, sort_order)
         VALUES (?, NULL, ?, ?, NULL, ?,
                 (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM relation_types))",
        row.id,
        row.name,
        row.icon,
        row.category
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn update_relation_type(
    tx: &mut Transaction<'_, Sqlite>,
    id: &str,
    name: &str,
    icon: &str,
    category: &str,
) -> AppResult<bool> {
    let done = sqlx::query!(
        "UPDATE relation_types SET name = ?, icon = ?, category = ? WHERE id = ?",
        name,
        icon,
        category,
        id
    )
    .execute(&mut **tx)
    .await?;
    Ok(done.rows_affected() > 0)
}

pub async fn set_inverse(
    tx: &mut Transaction<'_, Sqlite>,
    id: &str,
    inverse_id: Option<&str>,
) -> AppResult<()> {
    sqlx::query!(
        "UPDATE relation_types SET inverse_id = ? WHERE id = ?",
        inverse_id,
        id
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Types whose inverse is `id`.
pub async fn inverses_of(tx: &mut Transaction<'_, Sqlite>, id: &str) -> AppResult<Vec<String>> {
    Ok(sqlx::query_scalar!(
        r#"SELECT id AS "id!" FROM relation_types WHERE inverse_id = ?"#,
        id
    )
    .fetch_all(&mut **tx)
    .await?)
}

pub async fn delete_relation_type(tx: &mut Transaction<'_, Sqlite>, id: &str) -> AppResult<bool> {
    let done = sqlx::query!("DELETE FROM relation_types WHERE id = ?", id)
        .execute(&mut **tx)
        .await?;
    Ok(done.rows_affected() > 0)
}

/// Edges of every tree using the relation type `id`.
pub async fn count_edges_of_type(pool: &SqlitePool, id: &str) -> AppResult<i64> {
    Ok(sqlx::query_scalar!(
        r#"SELECT COUNT(*) AS "count!: i64" FROM tree_edges WHERE relation_type_id = ?"#,
        id
    )
    .fetch_one(pool)
    .await?)
}

// --- Trees and variants ------------------------------------------------------

pub async fn insert_tree(tx: &mut Transaction<'_, Sqlite>, document_id: &str) -> AppResult<()> {
    sqlx::query!("INSERT INTO trees (document_id) VALUES (?)", document_id)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

pub async fn tree_title(pool: &SqlitePool, id: &str) -> AppResult<Option<String>> {
    Ok(sqlx::query_scalar!(
        r#"SELECT d.title FROM trees t JOIN documents d ON d.id = t.document_id
           WHERE t.document_id = ?"#,
        id
    )
    .fetch_optional(pool)
    .await?)
}

pub async fn variants(pool: &SqlitePool, tree_id: &str) -> AppResult<Vec<VariantRow>> {
    Ok(sqlx::query_as!(
        VariantRow,
        r#"SELECT id AS "id!", name FROM tree_variants WHERE tree_id = ? ORDER BY sort_order"#,
        tree_id
    )
    .fetch_all(pool)
    .await?)
}

/// The tree a variant belongs to.
pub async fn tree_of_variant(pool: &SqlitePool, variant_id: &str) -> AppResult<Option<String>> {
    Ok(sqlx::query_scalar!(
        r#"SELECT tree_id AS "tree_id!" FROM tree_variants WHERE id = ?"#,
        variant_id
    )
    .fetch_optional(pool)
    .await?)
}

pub async fn insert_variant(
    tx: &mut Transaction<'_, Sqlite>,
    id: &str,
    tree_id: &str,
    name: &str,
    order: i64,
) -> AppResult<()> {
    sqlx::query!(
        "INSERT INTO tree_variants (id, tree_id, name, sort_order) VALUES (?, ?, ?, ?)",
        id,
        tree_id,
        name,
        order
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn rename_variant(pool: &SqlitePool, id: &str, name: &str) -> AppResult<bool> {
    let done = sqlx::query!("UPDATE tree_variants SET name = ? WHERE id = ?", name, id)
        .execute(pool)
        .await?;
    Ok(done.rows_affected() > 0)
}

pub async fn set_variant_order(
    tx: &mut Transaction<'_, Sqlite>,
    id: &str,
    order: i64,
) -> AppResult<()> {
    sqlx::query!(
        "UPDATE tree_variants SET sort_order = ? WHERE id = ?",
        order,
        id
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn delete_variant(tx: &mut Transaction<'_, Sqlite>, id: &str) -> AppResult<()> {
    sqlx::query!("DELETE FROM tree_variants WHERE id = ?", id)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

// --- A variant's content -----------------------------------------------------

pub async fn nodes(pool: &SqlitePool, variant_id: &str) -> AppResult<Vec<NodeRow>> {
    Ok(sqlx::query_as!(
        NodeRow,
        r#"SELECT id AS "id!", card_id, label, x, y FROM tree_nodes
           WHERE variant_id = ? ORDER BY sort_order"#,
        variant_id
    )
    .fetch_all(pool)
    .await?)
}

pub async fn edges(pool: &SqlitePool, variant_id: &str) -> AppResult<Vec<EdgeRow>> {
    Ok(sqlx::query_as!(
        EdgeRow,
        r#"SELECT id AS "id!", source_node_id, source_edge_id, target_node_id, relation_type_id,
                  line_style
           FROM tree_edges WHERE variant_id = ? ORDER BY sort_order"#,
        variant_id
    )
    .fetch_all(pool)
    .await?)
}

pub async fn annotations(pool: &SqlitePool, variant_id: &str) -> AppResult<Vec<AnnotationRow>> {
    Ok(sqlx::query_as!(
        AnnotationRow,
        r#"SELECT id AS "id!", data FROM tree_annotations
           WHERE variant_id = ? ORDER BY sort_order"#,
        variant_id
    )
    .fetch_all(pool)
    .await?)
}

/// Removes the variant's nodes, edges and annotations.
pub async fn clear(tx: &mut Transaction<'_, Sqlite>, variant_id: &str) -> AppResult<()> {
    sqlx::query!("DELETE FROM tree_edges WHERE variant_id = ?", variant_id)
        .execute(&mut **tx)
        .await?;
    sqlx::query!("DELETE FROM tree_nodes WHERE variant_id = ?", variant_id)
        .execute(&mut **tx)
        .await?;
    sqlx::query!(
        "DELETE FROM tree_annotations WHERE variant_id = ?",
        variant_id
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn insert_node(
    tx: &mut Transaction<'_, Sqlite>,
    variant_id: &str,
    node: &NodeRow,
    order: i64,
) -> AppResult<()> {
    sqlx::query!(
        "INSERT INTO tree_nodes (id, variant_id, card_id, label, x, y, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
        node.id,
        variant_id,
        node.card_id,
        node.label,
        node.x,
        node.y,
        order
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn insert_edge(
    tx: &mut Transaction<'_, Sqlite>,
    variant_id: &str,
    edge: &EdgeRow,
    order: i64,
) -> AppResult<()> {
    sqlx::query!(
        "INSERT INTO tree_edges (id, variant_id, source_node_id, source_edge_id, target_node_id,
                                 relation_type_id, line_style, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        edge.id,
        variant_id,
        edge.source_node_id,
        edge.source_edge_id,
        edge.target_node_id,
        edge.relation_type_id,
        edge.line_style,
        order
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn insert_annotation(
    tx: &mut Transaction<'_, Sqlite>,
    variant_id: &str,
    annotation: &AnnotationRow,
    order: i64,
) -> AppResult<()> {
    sqlx::query!(
        "INSERT INTO tree_annotations (id, variant_id, data, sort_order) VALUES (?, ?, ?, ?)",
        annotation.id,
        variant_id,
        annotation.data,
        order
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Known relation type ids (to check a content's edges).
pub async fn relation_type_ids(pool: &SqlitePool) -> AppResult<Vec<String>> {
    Ok(
        sqlx::query_scalar!(r#"SELECT id AS "id!" FROM relation_types"#)
            .fetch_all(pool)
            .await?,
    )
}
