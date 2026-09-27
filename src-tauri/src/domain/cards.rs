//! Cards: the world's entries (a character, a place, an item…). A card is a
//! document (title, dates, trash) plus its type, image, aliases and content.

use serde::Serialize;
use specta::Type;
use sqlx::SqlitePool;

use crate::db::cards::{self as queries, CardRow};
use crate::db::documents as document_queries;
use crate::domain::documents::{self, DocumentKind, now};
use crate::domain::{card_types, content};
use crate::error::{AppError, AppResult};

#[cfg(test)]
mod tests;

/// Most aliases a card can have.
pub const MAX_ALIASES: usize = 20;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Card {
    /// The card's document id.
    pub id: String,
    pub title: String,
    /// Type or subtype; `null` only if its type vanished.
    pub type_id: Option<String>,
    /// Asset id of the card's image.
    pub image_asset_id: Option<String>,
    /// Other names, used by search and mentions.
    pub aliases: Vec<String>,
    /// RFC 3339 dates.
    pub created_at: String,
    pub updated_at: String,
    /// Set while the card is in the trash.
    pub trashed_at: Option<String>,
}

impl From<CardRow> for Card {
    fn from(row: CardRow) -> Self {
        Self {
            aliases: serde_json::from_str(&row.aliases).unwrap_or_default(),
            id: row.id,
            title: row.title,
            type_id: row.type_id,
            image_asset_id: row.image_asset_id,
            created_at: row.created_at,
            updated_at: row.updated_at,
            trashed_at: row.trashed_at,
        }
    }
}

pub async fn get(pool: &SqlitePool, id: &str) -> AppResult<Card> {
    Ok(queries::get(pool, id)
        .await?
        .ok_or_else(|| AppError::InvalidInput(format!("card not found: {id}")))?
        .into())
}

/// Cards of the world, or of its trash, by title.
pub async fn list(pool: &SqlitePool, trashed: bool) -> AppResult<Vec<Card>> {
    Ok(queries::list(pool, trashed)
        .await?
        .into_iter()
        .map(Card::from)
        .collect())
}

/// Creates a card of the type (or subtype) `type_id`, titled `title`.
pub async fn create(pool: &SqlitePool, type_id: &str, title: &str) -> AppResult<Card> {
    card_types::get(pool, type_id).await?;
    let mut tx = pool.begin().await?;
    let document = documents::create_in(&mut tx, DocumentKind::Card, title).await?;
    queries::insert(&mut tx, &document.id, type_id).await?;
    tx.commit().await?;
    get(pool, &document.id).await
}

/// Changes the card's type or subtype.
pub async fn set_type(pool: &SqlitePool, id: &str, type_id: &str) -> AppResult<Card> {
    get(pool, id).await?;
    card_types::get(pool, type_id).await?;
    let mut tx = pool.begin().await?;
    queries::set_type(&mut tx, id, type_id).await?;
    document_queries::touch(&mut tx, id, &now()).await?;
    tx.commit().await?;
    get(pool, id).await
}

/// Sets (asset id) or removes (`None`) the card's image.
pub async fn set_image(pool: &SqlitePool, id: &str, asset_id: Option<&str>) -> AppResult<Card> {
    get(pool, id).await?;
    if let Some(asset) = asset_id
        && crate::db::assets::get(pool, asset).await?.is_none()
    {
        return Err(AppError::InvalidInput(format!("asset not found: {asset}")));
    }
    let mut tx = pool.begin().await?;
    queries::set_image(&mut tx, id, asset_id).await?;
    document_queries::touch(&mut tx, id, &now()).await?;
    tx.commit().await?;
    get(pool, id).await
}

/// Aliases trimmed, without empty ones or duplicates (ignoring case), each
/// at most as long as a title, and not too many.
fn clean_aliases(aliases: &[String]) -> AppResult<Vec<String>> {
    let mut clean: Vec<String> = Vec::new();
    for alias in aliases {
        let alias = alias.trim();
        if alias.is_empty()
            || clean
                .iter()
                .any(|kept| kept.to_lowercase() == alias.to_lowercase())
        {
            continue;
        }
        if alias.chars().count() > documents::MAX_TITLE_LEN {
            return Err(AppError::InvalidInput(format!(
                "an alias is at most {} characters",
                documents::MAX_TITLE_LEN
            )));
        }
        clean.push(alias.to_owned());
    }
    if clean.len() > MAX_ALIASES {
        return Err(AppError::InvalidInput(format!(
            "a card has at most {MAX_ALIASES} aliases"
        )));
    }
    Ok(clean)
}

/// Replaces the card's aliases.
pub async fn set_aliases(pool: &SqlitePool, id: &str, aliases: &[String]) -> AppResult<Card> {
    get(pool, id).await?;
    let json = serde_json::to_string(&clean_aliases(aliases)?)
        .map_err(|error| AppError::Internal(error.to_string()))?;
    let mut tx = pool.begin().await?;
    queries::set_aliases(&mut tx, id, &json).await?;
    document_queries::touch(&mut tx, id, &now()).await?;
    tx.commit().await?;
    get(pool, id).await
}

/// How many live cards a type (or subtype) has.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct TypeCount {
    pub type_id: String,
    pub count: u32,
}

/// Number of live cards per type or subtype (for the world summary).
pub async fn count_by_type(pool: &SqlitePool) -> AppResult<Vec<TypeCount>> {
    Ok(queries::count_by_type(pool)
        .await?
        .into_iter()
        .map(|(type_id, count)| TypeCount {
            type_id,
            count: u32::try_from(count).unwrap_or(u32::MAX),
        })
        .collect())
}

/// The card's content blocks, as JSON (see `content`).
pub async fn content(pool: &SqlitePool, id: &str) -> AppResult<String> {
    queries::content(pool, id)
        .await?
        .ok_or_else(|| AppError::InvalidInput(format!("card not found: {id}")))
}

/// Replaces the card's content blocks and their plain text.
pub async fn set_content(pool: &SqlitePool, id: &str, json: &str) -> AppResult<()> {
    get(pool, id).await?;
    let blocks = content::parse(json)?;
    let text = content::plain_text(&blocks);
    let mut tx = pool.begin().await?;
    queries::set_content(&mut tx, id, json, &text).await?;
    document_queries::touch(&mut tx, id, &now()).await?;
    tx.commit().await?;
    Ok(())
}

/// Number of cards of a type and its subtypes (to ask where they go before
/// deleting it).
pub async fn count_of_type(pool: &SqlitePool, type_id: &str) -> AppResult<u32> {
    let count = queries::count_of_type(pool, type_id).await?;
    Ok(u32::try_from(count).unwrap_or(u32::MAX))
}
