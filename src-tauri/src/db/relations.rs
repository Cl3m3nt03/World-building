//! Queries of the relations the world knows (ADR 0007).

use sqlx::SqlitePool;

use crate::error::AppResult;

/// A value of a link property that carries a relation.
pub struct PropertyRelationRow {
    /// The card holding the property.
    pub holder_id: String,
    /// A card chosen in it.
    pub value_id: String,
    pub relation_type_id: String,
}

/// The values of the link properties that carry a relation (their links).
pub async fn property_relations(pool: &SqlitePool) -> AppResult<Vec<PropertyRelationRow>> {
    Ok(sqlx::query_as!(
        PropertyRelationRow,
        r#"SELECT l.source_id AS "holder_id!", l.target_id AS "value_id!",
                  p.relation_type_id AS "relation_type_id!"
           FROM links l
           JOIN property_definitions p ON p.id = l.detail
           WHERE l.kind = 'property' AND p.relation_type_id IS NOT NULL
           ORDER BY l.source_id, p.sort_order, l.target_id"#
    )
    .fetch_all(pool)
    .await?)
}

/// The ids of the live cards.
pub async fn live_cards(pool: &SqlitePool) -> AppResult<Vec<String>> {
    Ok(sqlx::query_scalar!(
        r#"SELECT d.id AS "id!" FROM cards c JOIN documents d ON d.id = c.document_id
           WHERE d.trashed_at IS NULL"#
    )
    .fetch_all(pool)
    .await?)
}
