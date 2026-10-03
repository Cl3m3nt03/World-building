//! The relations a world already knows between its cards (ADR 0007, M7.5
//! step 7.5.4): those drawn in the trees and those of the link properties
//! that carry a relation. A new tree can start from them.

use std::collections::{HashMap, HashSet};

use serde::Serialize;
use specta::Type;
use sqlx::SqlitePool;

use crate::db::relations as queries;
use crate::domain::{graphs, trees};
use crate::error::AppResult;

/// A relation between two cards, as the trees word it: `to` is
/// `relation_type_id` of `from` (« Aragorn : enfant de Arathorn »).
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct KnownRelation {
    pub from: String,
    pub to: String,
    /// `None`: a link without a type, drawn in a tree.
    pub relation_type_id: Option<String>,
}

/// One way of saying a relation, whichever way it was said: a relation with
/// an inverse is kept as the one of the two whose id comes first
/// (« enfant de » rather than « parent de »: the parent is `from`), a
/// symmetric one with its cards in order.
pub fn canonical(relation: KnownRelation, inverses: &HashMap<String, String>) -> KnownRelation {
    let Some(kind) = relation.relation_type_id.clone() else {
        return relation;
    };
    match inverses.get(&kind) {
        Some(inverse) if *inverse == kind => {
            if relation.from <= relation.to {
                relation
            } else {
                KnownRelation {
                    from: relation.to,
                    to: relation.from,
                    relation_type_id: Some(kind),
                }
            }
        }
        Some(inverse) if *inverse < kind => KnownRelation {
            from: relation.to,
            to: relation.from,
            relation_type_id: Some(inverse.clone()),
        },
        _ => relation,
    }
}

/// The world's known relations between live cards, each said once (see
/// `canonical`), the trees' first, then the properties'.
pub async fn known(pool: &SqlitePool) -> AppResult<Vec<KnownRelation>> {
    let inverses: HashMap<String, String> = trees::relation_types(pool)
        .await?
        .into_iter()
        .filter_map(|kind| kind.inverse_id.map(|inverse| (kind.id, inverse)))
        .collect();
    let mut found = Vec::new();
    for (from, to, relation_type_id, _, _) in graphs::live_tree_relations(pool).await? {
        found.push(KnownRelation {
            from,
            to,
            relation_type_id,
        });
    }
    // « Parents » set to *parent of* on Aragorn, with Arathorn: Arathorn is
    // parent of Aragorn.
    for row in queries::property_relations(pool).await? {
        found.push(KnownRelation {
            from: row.holder_id,
            to: row.value_id,
            relation_type_id: Some(row.relation_type_id),
        });
    }
    let live: HashSet<String> = queries::live_cards(pool).await?.into_iter().collect();
    let mut seen = HashSet::new();
    Ok(found
        .into_iter()
        .filter(|relation| {
            relation.from != relation.to
                && live.contains(&relation.from)
                && live.contains(&relation.to)
        })
        .map(|relation| canonical(relation, &inverses))
        .filter(|relation| seen.insert(relation.clone()))
        .collect())
}

#[cfg(test)]
mod tests;
