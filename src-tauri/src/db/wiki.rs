//! Queries of the wiki (migration 0017).

use sqlx::SqlitePool;

use crate::error::AppResult;

pub struct SettingsRow {
    pub title: String,
    pub description: String,
    pub banner_asset_id: Option<String>,
    pub featured: String,
    pub theme: String,
}

/// A page of the wiki: a live card or map marked visible.
pub struct PageRow {
    pub id: String,
    pub kind: String,
    pub title: String,
    pub type_id: Option<String>,
    pub image_asset_id: Option<String>,
    pub aliases: Option<String>,
}

pub async fn settings(pool: &SqlitePool) -> AppResult<SettingsRow> {
    Ok(sqlx::query_as!(
        SettingsRow,
        "SELECT title, description, banner_asset_id, featured, theme FROM wiki_settings WHERE id = 1"
    )
    .fetch_one(pool)
    .await?)
}

pub async fn save_settings(pool: &SqlitePool, row: &SettingsRow) -> AppResult<()> {
    sqlx::query!(
        "UPDATE wiki_settings SET title = ?, description = ?, banner_asset_id = ?, featured = ?,
                theme = ? WHERE id = 1",
        row.title,
        row.description,
        row.banner_asset_id,
        row.featured,
        row.theme
    )
    .execute(pool)
    .await?;
    Ok(())
}

/// Marks a card or a map visible in the wiki or not; whether it was found.
pub async fn set_visible(pool: &SqlitePool, id: &str, visible: bool) -> AppResult<bool> {
    let visible = i64::from(visible);
    let done = sqlx::query!(
        "UPDATE documents SET wiki_visible = ? WHERE id = ? AND kind IN ('card', 'map')",
        visible,
        id
    )
    .execute(pool)
    .await?;
    Ok(done.rows_affected() > 0)
}

/// The wiki's pages: live cards and maps marked visible, by title.
pub async fn pages(pool: &SqlitePool) -> AppResult<Vec<PageRow>> {
    Ok(sqlx::query_as!(
        PageRow,
        r#"SELECT d.id AS "id!", d.kind AS "kind!", d.title AS "title!", c.type_id,
                  c.image_asset_id, c.aliases
           FROM documents d LEFT JOIN cards c ON c.document_id = d.id
           WHERE d.wiki_visible = 1 AND d.trashed_at IS NULL AND d.kind IN ('card', 'map')
           ORDER BY d.title COLLATE NOCASE, d.created_at"#
    )
    .fetch_all(pool)
    .await?)
}

/// Whether the wiki's banner is the asset `asset_id`.
pub async fn is_banner(pool: &SqlitePool, asset_id: &str) -> AppResult<bool> {
    Ok(sqlx::query_scalar!(
        r#"SELECT COUNT(*) AS "count!: i64" FROM wiki_settings WHERE banner_asset_id = ?"#,
        asset_id
    )
    .fetch_one(pool)
    .await?
        > 0)
}
