//! Card properties: structured fields defined on a card type (shown by its
//! cards and by the cards of its subtypes) or on a single card, and the
//! cards' values for them. A link property's values are also links in the
//! `links` table (kind `property`, detail = the property id).

use serde::{Deserialize, Serialize};
use specta::Type;
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::db;
use crate::db::properties::{self as queries, DefinitionRow};
use crate::domain::documents::now;
use crate::domain::links::{self, LinkKind};
use crate::domain::trees;
use crate::domain::{card_types, cards};
use crate::error::{AppError, AppResult};

#[cfg(test)]
mod tests;

/// Longest property label, in characters.
pub const MAX_LABEL_LEN: usize = 80;
/// Longest text value, in characters.
pub const MAX_TEXT_LEN: usize = 10_000;
/// Most cards a "links to several cards" value holds.
pub const MAX_LINKED_CARDS: usize = 200;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum PropertyKind {
    Text,
    Number,
    /// A link to one card.
    Card,
    /// Links to several cards.
    Cards,
}

impl PropertyKind {
    fn as_str(self) -> &'static str {
        match self {
            Self::Text => "text",
            Self::Number => "number",
            Self::Card => "card",
            Self::Cards => "cards",
        }
    }

    fn parse(value: &str) -> AppResult<Self> {
        Ok(match value {
            "text" => Self::Text,
            "number" => Self::Number,
            "card" => Self::Card,
            "cards" => Self::Cards,
            other => {
                return Err(AppError::Internal(format!(
                    "unknown property kind: {other}"
                )));
            }
        })
    }
}

/// Where a property is defined.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(tag = "on", rename_all = "camelCase")]
pub enum PropertyOwner {
    /// On a card type: its cards and its subtypes' cards show it.
    #[serde(rename_all = "camelCase")]
    Type { type_id: String },
    /// On one card only.
    #[serde(rename_all = "camelCase")]
    Card { card_id: String },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PropertyDefinition {
    pub id: String,
    pub owner: PropertyOwner,
    pub label: String,
    pub kind: PropertyKind,
    /// For links: card types allowed as targets (empty: any).
    pub target_type_ids: Vec<String>,
    /// For links: the relation each chosen card is of the card holding the
    /// property (« Parents » = parent of), ADR 0007. `None`: just a link.
    pub relation_type_id: Option<String>,
    /// For a type property: whether cards created before it show it too.
    pub applies_to_existing: bool,
    pub sort_order: i32,
    /// RFC 3339.
    pub created_at: String,
}

impl TryFrom<DefinitionRow> for PropertyDefinition {
    type Error = AppError;

    fn try_from(row: DefinitionRow) -> AppResult<Self> {
        let owner = match (row.type_id, row.card_id) {
            (Some(type_id), None) => PropertyOwner::Type { type_id },
            (None, Some(card_id)) => PropertyOwner::Card { card_id },
            _ => {
                return Err(AppError::Internal(format!(
                    "property {} has no single owner",
                    row.id
                )));
            }
        };
        Ok(Self {
            kind: PropertyKind::parse(&row.kind)?,
            target_type_ids: serde_json::from_str(&row.target_type_ids).unwrap_or_default(),
            relation_type_id: row.relation_type_id,
            applies_to_existing: row.applies_to_existing != 0,
            sort_order: i32::try_from(row.sort_order).unwrap_or(i32::MAX),
            id: row.id,
            owner,
            label: row.label,
            created_at: row.created_at,
        })
    }
}

/// A card's value for a property.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(tag = "kind", content = "value", rename_all = "camelCase")]
pub enum PropertyValue {
    Text(String),
    Number(f64),
    /// A card id.
    Card(String),
    /// Card ids.
    Cards(Vec<String>),
}

impl PropertyValue {
    fn kind(&self) -> PropertyKind {
        match self {
            Self::Text(_) => PropertyKind::Text,
            Self::Number(_) => PropertyKind::Number,
            Self::Card(_) => PropertyKind::Card,
            Self::Cards(_) => PropertyKind::Cards,
        }
    }

    /// Cards the value links to.
    fn targets(&self) -> Vec<String> {
        match self {
            Self::Card(id) => vec![id.clone()],
            Self::Cards(ids) => ids.clone(),
            Self::Text(_) | Self::Number(_) => Vec::new(),
        }
    }
}

/// A property as a card shows it: its definition and the card's value.
#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CardProperty {
    pub definition: PropertyDefinition,
    pub value: Option<PropertyValue>,
}

fn validate_label(label: &str) -> AppResult<String> {
    let label = label.trim();
    if label.is_empty() {
        return Err(AppError::InvalidInput(
            "a property label cannot be empty".into(),
        ));
    }
    if label.chars().count() > MAX_LABEL_LEN {
        return Err(AppError::InvalidInput(format!(
            "a property label is at most {MAX_LABEL_LEN} characters"
        )));
    }
    Ok(label.to_owned())
}

fn to_json<T: Serialize>(value: &T) -> AppResult<String> {
    serde_json::to_string(value).map_err(|error| AppError::Internal(error.to_string()))
}

pub async fn get(pool: &SqlitePool, id: &str) -> AppResult<PropertyDefinition> {
    queries::get(pool, id)
        .await?
        .ok_or_else(|| AppError::InvalidInput(format!("property not found: {id}")))?
        .try_into()
}

/// Properties defined on a card type (not the inherited ones), in order.
pub async fn of_type(pool: &SqlitePool, type_id: &str) -> AppResult<Vec<PropertyDefinition>> {
    queries::of_type(pool, type_id)
        .await?
        .into_iter()
        .map(PropertyDefinition::try_from)
        .collect()
}

async fn siblings(pool: &SqlitePool, owner: &PropertyOwner) -> AppResult<Vec<DefinitionRow>> {
    match owner {
        PropertyOwner::Type { type_id } => queries::of_type(pool, type_id).await,
        PropertyOwner::Card { card_id } => queries::of_card(pool, card_id).await,
    }
}

/// Adds a property to a type or a card, after the existing ones. A type
/// property first applies to the cards created from now on; see
/// `apply_to_existing`.
pub async fn create(
    pool: &SqlitePool,
    owner: PropertyOwner,
    label: &str,
    kind: PropertyKind,
) -> AppResult<PropertyDefinition> {
    let (type_id, card_id) = match &owner {
        PropertyOwner::Type { type_id } => {
            card_types::get(pool, type_id).await?;
            (Some(type_id.clone()), None)
        }
        PropertyOwner::Card { card_id } => {
            cards::get(pool, card_id).await?;
            (None, Some(card_id.clone()))
        }
    };
    let order = siblings(pool, &owner)
        .await?
        .iter()
        .map(|row| row.sort_order + 1)
        .max()
        .unwrap_or(0);
    let row = DefinitionRow {
        id: Uuid::new_v4().to_string(),
        type_id,
        card_id,
        label: validate_label(label)?,
        kind: kind.as_str().into(),
        target_type_ids: "[]".into(),
        relation_type_id: None,
        applies_to_existing: 0,
        sort_order: order,
        created_at: now(),
    };
    queries::insert(pool, &row).await?;
    row.try_into()
}

/// Renames a property everywhere it is shown.
pub async fn rename(pool: &SqlitePool, id: &str, label: &str) -> AppResult<PropertyDefinition> {
    get(pool, id).await?;
    queries::set_label(pool, id, &validate_label(label)?).await?;
    get(pool, id).await
}

/// Changes a property's kind (and link targets). Values of another kind are
/// dropped, with their links.
pub async fn set_kind(
    pool: &SqlitePool,
    id: &str,
    kind: PropertyKind,
    target_type_ids: &[String],
) -> AppResult<PropertyDefinition> {
    let before = get(pool, id).await?;
    for target in target_type_ids {
        card_types::get(pool, target).await?;
    }
    let targets = match kind {
        PropertyKind::Card | PropertyKind::Cards => to_json(&target_type_ids)?,
        PropertyKind::Text | PropertyKind::Number => "[]".into(),
    };
    if before.kind != kind {
        queries::clear_values(pool, id).await?;
        links::remove_detail(pool, LinkKind::Property, id).await?;
    }
    queries::set_kind(pool, id, kind.as_str(), &targets).await?;
    // Only a link is a relation.
    if matches!(kind, PropertyKind::Text | PropertyKind::Number) {
        queries::set_relation(pool, id, None).await?;
    }
    get(pool, id).await
}

/// Makes a link property a relation of the world, or just a link again
/// (`None`): each chosen card is then `relation_type_id` of the card holding
/// the property (ADR 0007).
pub async fn set_relation(
    pool: &SqlitePool,
    id: &str,
    relation_type_id: Option<&str>,
) -> AppResult<PropertyDefinition> {
    let property = get(pool, id).await?;
    if let Some(relation) = relation_type_id {
        if !matches!(property.kind, PropertyKind::Card | PropertyKind::Cards) {
            return Err(AppError::InvalidInput(
                "only a link property can be a relation".into(),
            ));
        }
        if !trees::relation_types(pool)
            .await?
            .iter()
            .any(|known| known.id == relation)
        {
            return Err(AppError::InvalidInput(format!(
                "relation type not found: {relation}"
            )));
        }
    }
    queries::set_relation(pool, id, relation_type_id).await?;
    get(pool, id).await
}

/// Makes a type property show on the cards created before it too.
pub async fn apply_to_existing(pool: &SqlitePool, id: &str) -> AppResult<PropertyDefinition> {
    get(pool, id).await?;
    queries::set_applies_to_existing(pool, id).await?;
    get(pool, id).await
}

/// Orders the properties of one owner as `ids` (all of them, once).
pub async fn reorder(pool: &SqlitePool, ids: &[String]) -> AppResult<()> {
    let Some(first) = ids.first() else {
        return Ok(());
    };
    let owner = get(pool, first).await?.owner;
    let mut expected: Vec<String> = siblings(pool, &owner)
        .await?
        .into_iter()
        .map(|r| r.id)
        .collect();
    let mut given = ids.to_vec();
    expected.sort();
    given.sort();
    if expected != given {
        return Err(AppError::InvalidInput(
            "reorder must list every property of the owner exactly once".into(),
        ));
    }
    let mut tx = db::begin_write(pool).await?;
    for (order, id) in (0_i64..).zip(ids) {
        queries::set_order(&mut tx, id, order).await?;
    }
    tx.commit().await?;
    Ok(())
}

/// Number of values that deleting the property would lose.
pub async fn count_values(pool: &SqlitePool, id: &str) -> AppResult<u32> {
    let count = queries::count_values(pool, id).await?;
    Ok(u32::try_from(count).unwrap_or(u32::MAX))
}

/// Deletes a property, its values and their links.
pub async fn delete(pool: &SqlitePool, id: &str) -> AppResult<()> {
    get(pool, id).await?;
    links::remove_detail(pool, LinkKind::Property, id).await?;
    queries::delete(pool, id).await
}

/// The properties a card shows, in order: its type's (the parent type's
/// first for a subtype), then its own; with its values.
pub async fn of_card(pool: &SqlitePool, card_id: &str) -> AppResult<Vec<CardProperty>> {
    let card = cards::get(pool, card_id).await?;
    let mut definitions: Vec<PropertyDefinition> = Vec::new();
    if let Some(type_id) = &card.type_id {
        let card_type = card_types::get(pool, type_id).await?;
        let mut type_ids: Vec<&str> = Vec::new();
        if let Some(parent) = &card_type.parent_id {
            type_ids.push(parent);
        }
        type_ids.push(type_id);
        for id in type_ids {
            for definition in of_type(pool, id).await? {
                // Cards made before the property show it once it applies to them.
                if definition.applies_to_existing || card.created_at >= definition.created_at {
                    definitions.push(definition);
                }
            }
        }
    }
    for row in queries::of_card(pool, card_id).await? {
        definitions.push(row.try_into()?);
    }

    let values = queries::values_of(pool, card_id).await?;
    Ok(definitions
        .into_iter()
        .map(|definition| {
            let value = values
                .iter()
                .find(|(property, _)| *property == definition.id)
                .and_then(|(_, json)| serde_json::from_str::<PropertyValue>(json).ok())
                .filter(|value| value.kind() == definition.kind);
            CardProperty { definition, value }
        })
        .collect())
}

fn validate_value(value: &PropertyValue) -> AppResult<()> {
    match value {
        PropertyValue::Text(text) if text.chars().count() > MAX_TEXT_LEN => Err(
            AppError::InvalidInput(format!("a text value is at most {MAX_TEXT_LEN} characters")),
        ),
        PropertyValue::Number(number) if !number.is_finite() => Err(AppError::InvalidInput(
            "a number value must be finite".into(),
        )),
        PropertyValue::Cards(ids) if ids.len() > MAX_LINKED_CARDS => Err(AppError::InvalidInput(
            format!("a property links at most {MAX_LINKED_CARDS} cards"),
        )),
        _ => Ok(()),
    }
}

/// Sets (or clears, with `None`) a card's value for one of the properties
/// it shows. Link values must point to live cards of the allowed types.
pub async fn set_value(
    pool: &SqlitePool,
    card_id: &str,
    property_id: &str,
    value: Option<PropertyValue>,
) -> AppResult<Vec<CardProperty>> {
    let shown = of_card(pool, card_id).await?;
    let definition = shown
        .iter()
        .find(|property| property.definition.id == property_id)
        .map(|property| property.definition.clone())
        .ok_or_else(|| {
            AppError::InvalidInput(format!(
                "card {card_id} does not show property {property_id}"
            ))
        })?;

    // A value made empty is no value.
    let value = value.filter(|v| match v {
        PropertyValue::Text(text) => !text.trim().is_empty(),
        PropertyValue::Cards(ids) => !ids.is_empty(),
        PropertyValue::Number(_) | PropertyValue::Card(_) => true,
    });

    match &value {
        None => queries::clear_value(pool, card_id, property_id).await?,
        Some(value) => {
            if value.kind() != definition.kind {
                return Err(AppError::InvalidInput(format!(
                    "property {property_id} holds a {:?} value",
                    definition.kind
                )));
            }
            validate_value(value)?;
            for target in value.targets() {
                let card = cards::get(pool, &target).await?;
                if card.trashed_at.is_some() {
                    return Err(AppError::InvalidInput(format!(
                        "card in the trash: {target}"
                    )));
                }
                // A subtype's card is allowed where its type is.
                let allowed = if definition.target_type_ids.is_empty() {
                    true
                } else if let Some(type_id) = &card.type_id {
                    definition.target_type_ids.contains(type_id)
                        || card_types::get(pool, type_id)
                            .await?
                            .parent_id
                            .is_some_and(|parent| definition.target_type_ids.contains(&parent))
                } else {
                    false
                };
                if !allowed {
                    return Err(AppError::InvalidInput(format!(
                        "card {target} is not of a type allowed by property {property_id}"
                    )));
                }
            }
            queries::set_value(pool, card_id, property_id, &to_json(value)?).await?;
        }
    }
    let targets = value
        .as_ref()
        .map(PropertyValue::targets)
        .unwrap_or_default();
    links::replace(
        pool,
        card_id,
        LinkKind::Property,
        Some(property_id),
        &targets,
    )
    .await?;
    of_card(pool, card_id).await
}
