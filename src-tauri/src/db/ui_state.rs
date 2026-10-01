//! Queries on `ui_state` (ADR 0005).

use sqlx::SqlitePool;

use crate::error::AppResult;

pub async fn get(pool: &SqlitePool, key: &str) -> AppResult<Option<String>> {
    Ok(
        sqlx::query_scalar!("SELECT value FROM ui_state WHERE key = ?", key)
            .fetch_optional(pool)
            .await?,
    )
}

pub async fn set(pool: &SqlitePool, key: &str, value: &str) -> AppResult<()> {
    sqlx::query!(
        "INSERT INTO ui_state (key, value) VALUES (?1, ?2)
         ON CONFLICT (key) DO UPDATE SET value = ?2",
        key,
        value
    )
    .execute(pool)
    .await?;
    Ok(())
}
