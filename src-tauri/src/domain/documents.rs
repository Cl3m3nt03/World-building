//! Documents: everything shown in the sidebar (cards, maps, graphs,
//! canvases, relation trees). They share an id, a title, dates and the
//! world's trash; each kind keeps its own data in its tables.

use serde::{Deserialize, Serialize};
use specta::Type;
use sqlx::{Sqlite, SqlitePool, Transaction};
use time::OffsetDateTime;
use time::format_description::well_known::Rfc3339;
use uuid::Uuid;

use crate::db;
use crate::db::documents::{self as queries, DocumentRow};
use crate::db::links as link_queries;
use crate::db::tree as tree_queries;
use crate::domain::tree;
use crate::error::{AppError, AppResult};

#[cfg(test)]
mod tests;

/// Longest document title, in characters.
pub const MAX_TITLE_LEN: usize = 200;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum DocumentKind {
    Card,
    Map,
    Graph,
    Canvas,
    Tree,
}

impl DocumentKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Card => "card",
            Self::Map => "map",
            Self::Graph => "graph",
            Self::Canvas => "canvas",
            Self::Tree => "tree",
        }
    }

    pub(crate) fn parse(value: &str) -> AppResult<Self> {
        Ok(match value {
            "card" => Self::Card,
            "map" => Self::Map,
            "graph" => Self::Graph,
            "canvas" => Self::Canvas,
            "tree" => Self::Tree,
            other => {
                return Err(AppError::Internal(format!(
                    "unknown document kind: {other}"
                )));
            }
        })
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Document {
    pub id: String,
    pub kind: DocumentKind,
    pub title: String,
    /// RFC 3339 dates.
    pub created_at: String,
    pub updated_at: String,
    /// Last opening, if ever.
    pub opened_at: Option<String>,
    /// Set while the document is in the trash.
    pub trashed_at: Option<String>,
}

impl TryFrom<DocumentRow> for Document {
    type Error = AppError;

    fn try_from(row: DocumentRow) -> AppResult<Self> {
        Ok(Self {
            kind: DocumentKind::parse(&row.kind)?,
            id: row.id,
            title: row.title,
            created_at: row.created_at,
            updated_at: row.updated_at,
            opened_at: row.opened_at,
            trashed_at: row.trashed_at,
        })
    }
}

#[derive(Debug, Clone, Default, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct DocumentFilter {
    pub kind: Option<DocumentKind>,
    /// The trash's content instead of the live documents.
    pub trashed: bool,
}

pub(crate) fn now() -> String {
    OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .unwrap_or_default()
}

/// A title trimmed, non-empty and not too long.
pub fn validate_title(title: &str) -> AppResult<String> {
    let title = title.trim();
    if title.is_empty() {
        return Err(AppError::InvalidInput("a title cannot be empty".into()));
    }
    if title.chars().count() > MAX_TITLE_LEN {
        return Err(AppError::InvalidInput(format!(
            "a title is at most {MAX_TITLE_LEN} characters"
        )));
    }
    Ok(title.to_owned())
}

/// Creates a document of `kind` in `tx`, at the end of the sidebar's root.
/// The caller adds the kind's own data in the same transaction.
pub async fn create_in(
    tx: &mut Transaction<'_, Sqlite>,
    kind: DocumentKind,
    title: &str,
) -> AppResult<Document> {
    let now = now();
    let row = DocumentRow {
        id: Uuid::new_v4().to_string(),
        kind: kind.as_str().to_owned(),
        title: validate_title(title)?,
        created_at: now.clone(),
        updated_at: now,
        opened_at: None,
        trashed_at: None,
    };
    let order = tree::root_len(tx).await?;
    queries::insert(tx, &row).await?;
    tree_queries::set_document_order(tx, &row.id, order).await?;
    row.try_into()
}

/// Creates a document of `kind` with no data of its own (tests).
#[cfg(test)]
pub async fn create(pool: &SqlitePool, kind: DocumentKind, title: &str) -> AppResult<Document> {
    let mut tx = db::begin_write(pool).await?;
    let document = create_in(&mut tx, kind, title).await?;
    tx.commit().await?;
    Ok(document)
}

pub async fn get(pool: &SqlitePool, id: &str) -> AppResult<Document> {
    queries::get(pool, id)
        .await?
        .ok_or_else(|| AppError::InvalidInput(format!("document not found: {id}")))?
        .try_into()
}

pub async fn list(pool: &SqlitePool, filter: &DocumentFilter) -> AppResult<Vec<Document>> {
    queries::list(pool, filter.kind.map(DocumentKind::as_str), filter.trashed)
        .await?
        .into_iter()
        .map(Document::try_from)
        .collect()
}

/// A document opened recently, for the Home tab.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RecentDocument {
    pub id: String,
    pub kind: DocumentKind,
    pub title: String,
    /// RFC 3339.
    pub opened_at: String,
    /// For a card: its image and type.
    pub image_asset_id: Option<String>,
    pub type_id: Option<String>,
}

/// Records that a document was just opened (recent documents, "pick up where
/// you left off").
pub async fn mark_opened(pool: &SqlitePool, id: &str) -> AppResult<()> {
    if queries::set_opened(pool, id, &now()).await? {
        Ok(())
    } else {
        Err(AppError::InvalidInput(format!("document not found: {id}")))
    }
}

/// The `limit` documents opened most recently, not in the trash.
pub async fn recent(pool: &SqlitePool, limit: u32) -> AppResult<Vec<RecentDocument>> {
    queries::recent(pool, i64::from(limit))
        .await?
        .into_iter()
        .map(|row| {
            Ok(RecentDocument {
                kind: DocumentKind::parse(&row.kind)?,
                id: row.id,
                title: row.title,
                opened_at: row.opened_at,
                image_asset_id: row.image_asset_id,
                type_id: row.type_id,
            })
        })
        .collect()
}

pub async fn rename(pool: &SqlitePool, id: &str, title: &str) -> AppResult<Document> {
    let title = validate_title(title)?;
    if !queries::set_title(pool, id, &title, &now()).await? {
        return Err(AppError::InvalidInput(format!("document not found: {id}")));
    }
    get(pool, id).await
}

/// Puts a document in the trash. Links to it are kept: it can come back.
/// Its children stay in the sidebar, in its place (see `tree`).
pub async fn trash(pool: &SqlitePool, id: &str) -> AppResult<Document> {
    let document = get(pool, id).await?;
    if document.trashed_at.is_none() {
        let mut tx = db::begin_write(pool).await?;
        tree::trash_document(&mut tx, id, &now()).await?;
        tx.commit().await?;
    }
    get(pool, id).await
}

/// Takes a document out of the trash, back to its place in the sidebar if
/// that place still exists, else at the end of the root.
pub async fn restore(pool: &SqlitePool, id: &str) -> AppResult<Document> {
    get(pool, id).await?;
    let mut tx = db::begin_write(pool).await?;
    tree::restore_document(&mut tx, id).await?;
    tx.commit().await?;
    get(pool, id).await
}

/// Deletes a document of the trash for good, with its kind's data and the
/// links it makes. Links *to* it stay, as dead references.
pub async fn delete_forever(pool: &SqlitePool, id: &str) -> AppResult<()> {
    let document = get(pool, id).await?;
    if document.trashed_at.is_none() {
        return Err(AppError::InvalidInput(format!(
            "only a document in the trash can be deleted for good: {id}"
        )));
    }
    let mut tx = db::begin_write(pool).await?;
    link_queries::delete_all_from(&mut tx, id).await?;
    queries::delete(&mut tx, id).await?;
    tx.commit().await?;
    Ok(())
}

/// Deletes every document of the trash for good. Returns how many.
pub async fn empty_trash(pool: &SqlitePool) -> AppResult<usize> {
    let ids = queries::trashed_ids(pool).await?;
    let mut tx = db::begin_write(pool).await?;
    for id in &ids {
        link_queries::delete_all_from(&mut tx, id).await?;
        queries::delete(&mut tx, id).await?;
    }
    tx.commit().await?;
    Ok(ids.len())
}
