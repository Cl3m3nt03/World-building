//! Links between a source (a document, later a Quill chapter) and a target
//! card: mentions, link properties and map pins. Each module replaces the
//! links it owns when it saves; the table then feeds the backlinks, the
//! graph and name detection.

use serde::{Deserialize, Serialize};
use specta::Type;
use sqlx::SqlitePool;

use crate::db::links::{self as queries, LinkRow};
use crate::error::{AppError, AppResult};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum LinkKind {
    /// The card is cited in a text.
    Mention,
    /// The card is the value of a link property.
    Property,
    /// The card is pinned on a map.
    MapPin,
}

impl LinkKind {
    fn as_str(self) -> &'static str {
        match self {
            Self::Mention => "mention",
            Self::Property => "property",
            Self::MapPin => "map_pin",
        }
    }

    fn parse(value: &str) -> AppResult<Self> {
        Ok(match value {
            "mention" => Self::Mention,
            "property" => Self::Property,
            "map_pin" => Self::MapPin,
            other => return Err(AppError::Internal(format!("unknown link kind: {other}"))),
        })
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Link {
    pub source_id: String,
    pub target_id: String,
    pub kind: LinkKind,
    /// Where the link comes from inside the source (a property id…), or "".
    pub detail: String,
}

impl TryFrom<LinkRow> for Link {
    type Error = AppError;

    fn try_from(row: LinkRow) -> AppResult<Self> {
        Ok(Self {
            kind: LinkKind::parse(&row.kind)?,
            source_id: row.source_id,
            target_id: row.target_id,
            detail: row.detail,
        })
    }
}

/// Replaces the links of `kind` that `source_id` makes (for one `detail`, or
/// for all when `detail` is `None`) with links to `targets`.
pub async fn replace(
    pool: &SqlitePool,
    source_id: &str,
    kind: LinkKind,
    detail: Option<&str>,
    targets: &[String],
) -> AppResult<()> {
    let mut tx = pool.begin().await?;
    queries::delete_from(&mut tx, source_id, kind.as_str(), detail).await?;
    for target in targets {
        queries::insert(
            &mut tx,
            &LinkRow {
                source_id: source_id.to_owned(),
                target_id: target.clone(),
                kind: kind.as_str().to_owned(),
                detail: detail.unwrap_or_default().to_owned(),
            },
        )
        .await?;
    }
    tx.commit().await?;
    Ok(())
}

/// Removes the links of `kind` made with `detail` by any source.
pub async fn remove_detail(pool: &SqlitePool, kind: LinkKind, detail: &str) -> AppResult<()> {
    queries::delete_by_detail(pool, kind.as_str(), detail).await
}

/// Links pointing to `target_id`, whether their source still exists or not.
#[cfg_attr(not(test), allow(dead_code))]
pub async fn to_target(pool: &SqlitePool, target_id: &str) -> AppResult<Vec<Link>> {
    queries::to_target(pool, target_id)
        .await?
        .into_iter()
        .map(Link::try_from)
        .collect()
}
