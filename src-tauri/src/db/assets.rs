//! Queries on the `assets` table (media library).

use sqlx::SqlitePool;

use crate::error::AppResult;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AssetRow {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub mime: String,
    pub size: i64,
    pub width: Option<i64>,
    pub height: Option<i64>,
    pub created_at: String,
}

/// Inserts `row` unless an asset with the same id exists. Returns whether a
/// row was inserted.
pub async fn insert_if_absent(pool: &SqlitePool, row: &AssetRow) -> AppResult<bool> {
    let result = sqlx::query!(
        "INSERT OR IGNORE INTO assets (id, name, kind, mime, size, width, height, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        row.id,
        row.name,
        row.kind,
        row.mime,
        row.size,
        row.width,
        row.height,
        row.created_at,
    )
    .execute(pool)
    .await?;
    Ok(result.rows_affected() == 1)
}

pub async fn get(pool: &SqlitePool, id: &str) -> AppResult<Option<AssetRow>> {
    Ok(sqlx::query_as!(
        AssetRow,
        "SELECT id, name, kind, mime, size, width, height, created_at FROM assets WHERE id = ?",
        id
    )
    .fetch_optional(pool)
    .await?)
}

/// Assets, newest first, optionally filtered by kind and by a name fragment
/// (case-insensitive for ASCII, as SQLite's LIKE).
pub async fn list(
    pool: &SqlitePool,
    kind: Option<&str>,
    search: Option<&str>,
) -> AppResult<Vec<AssetRow>> {
    let pattern = search.map(|text| format!("%{}%", escape_like(text)));
    Ok(sqlx::query_as!(
        AssetRow,
        r#"SELECT id, name, kind, mime, size, width, height, created_at FROM assets
           WHERE (?1 IS NULL OR kind = ?1)
             AND (?2 IS NULL OR name LIKE ?2 ESCAPE '\')
           ORDER BY created_at DESC, name"#,
        kind,
        pattern,
    )
    .fetch_all(pool)
    .await?)
}

pub async fn ids(pool: &SqlitePool) -> AppResult<Vec<String>> {
    Ok(sqlx::query_scalar!("SELECT id FROM assets")
        .fetch_all(pool)
        .await?)
}

/// Returns whether the asset existed.
pub async fn rename(pool: &SqlitePool, id: &str, name: &str) -> AppResult<bool> {
    let result = sqlx::query!("UPDATE assets SET name = ? WHERE id = ?", name, id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() == 1)
}

/// Returns whether the asset existed.
pub async fn delete(pool: &SqlitePool, id: &str) -> AppResult<bool> {
    let result = sqlx::query!("DELETE FROM assets WHERE id = ?", id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() == 1)
}

/// Escapes `%`, `_` and `\` for a LIKE pattern using `ESCAPE '\'`.
fn escape_like(text: &str) -> String {
    let mut escaped = String::with_capacity(text.len());
    for character in text.chars() {
        if matches!(character, '%' | '_' | '\\') {
            escaped.push('\\');
        }
        escaped.push(character);
    }
    escaped
}
