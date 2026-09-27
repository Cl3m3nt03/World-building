//! Links between a source (a document, later a Quill chapter) and a target
//! card: mentions, link properties and map pins. Each module replaces the
//! links it owns when it saves; the table then feeds the backlinks, the
//! graph and name detection.

use serde::{Deserialize, Serialize};
use specta::Type;
use sqlx::{Sqlite, SqlitePool, Transaction};

use crate::db::links::{self as queries, LinkRow};
use crate::domain::documents::DocumentKind;
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
    replace_in(&mut tx, source_id, kind, detail, targets).await?;
    tx.commit().await?;
    Ok(())
}

/// `replace`, inside the caller's transaction (the links then change
/// together with what they come from).
pub async fn replace_in(
    tx: &mut Transaction<'_, Sqlite>,
    source_id: &str,
    kind: LinkKind,
    detail: Option<&str>,
    targets: &[String],
) -> AppResult<()> {
    queries::delete_from(tx, source_id, kind.as_str(), detail).await?;
    for target in targets {
        queries::insert(
            tx,
            &LinkRow {
                source_id: source_id.to_owned(),
                target_id: target.clone(),
                kind: kind.as_str().to_owned(),
                detail: detail.unwrap_or_default().to_owned(),
            },
        )
        .await?;
    }
    Ok(())
}

/// A document that cites a card, and how ("cited in" at the bottom of a card).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Backlink {
    pub source_id: String,
    pub source_kind: DocumentKind,
    pub source_title: String,
    /// For a card: its type.
    pub source_type_id: Option<String>,
    /// How the source cites the card: mentions, link properties (by label)…
    pub via: Vec<BacklinkVia>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct BacklinkVia {
    pub kind: LinkKind,
    /// The property's label, for a link property.
    pub property_label: Option<String>,
}

/// Live documents citing `target_id`, by title, each once with every way
/// it cites the card.
pub async fn backlinks(pool: &SqlitePool, target_id: &str) -> AppResult<Vec<Backlink>> {
    let mut backlinks: Vec<Backlink> = Vec::new();
    for row in queries::backlinks(pool, target_id).await? {
        let via = BacklinkVia {
            kind: LinkKind::parse(&row.link_kind)?,
            property_label: row.property_label,
        };
        match backlinks.last_mut() {
            Some(last) if last.source_id == row.source_id => {
                if !last.via.contains(&via) {
                    last.via.push(via);
                }
            }
            _ => backlinks.push(Backlink {
                source_kind: DocumentKind::parse(&row.source_kind)?,
                source_id: row.source_id,
                source_title: row.source_title,
                source_type_id: row.source_type_id,
                via: vec![via],
            }),
        }
    }
    Ok(backlinks)
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
