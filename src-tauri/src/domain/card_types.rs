//! Card types and subtypes: what a card represents, with its icon, color,
//! guided template and default card settings. A world gets default types
//! for its genre when it is created (or, for a world made before M2, the
//! first time it is opened); they are then ordinary, editable types.

pub mod defaults;

use serde::{Deserialize, Serialize};
use specta::Type;
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::db::card_types::{self as queries, CardTypeRow};
use crate::domain::documents::now;
use crate::error::{AppError, AppResult};
use crate::settings::Language;
use crate::world::Genre;

#[cfg(test)]
mod tests;

/// Longest type name, in characters.
pub const MAX_NAME_LEN: usize = 80;

/// Type colors, matching the `--bz-type-<color>` tokens of both themes.
pub const COLORS: [&str; 9] = [
    "red", "orange", "amber", "green", "teal", "blue", "violet", "pink", "slate",
];

/// `meta` key set once the default types have been created.
const SEEDED_KEY: &str = "card_types_seeded";

/// Shape of the card's image.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum Orientation {
    #[default]
    Portrait,
    Landscape,
}

/// How a card of this type shows on a canvas (M7).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum CanvasFormat {
    /// Name only.
    Compact,
    /// Image, name and type.
    #[default]
    Standard,
    /// Tall image.
    Tall,
    /// Wide image.
    Wide,
}

impl Orientation {
    fn as_str(self) -> &'static str {
        match self {
            Self::Portrait => "portrait",
            Self::Landscape => "landscape",
        }
    }

    fn parse(value: &str) -> Self {
        match value {
            "landscape" => Self::Landscape,
            _ => Self::Portrait,
        }
    }
}

impl CanvasFormat {
    fn as_str(self) -> &'static str {
        match self {
            Self::Compact => "compact",
            Self::Standard => "standard",
            Self::Tall => "tall",
            Self::Wide => "wide",
        }
    }

    fn parse(value: &str) -> Self {
        match value {
            "compact" => Self::Compact,
            "tall" => Self::Tall,
            "wide" => Self::Wide,
            _ => Self::Standard,
        }
    }
}

/// A section of a guided template: a title and a question to help write it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct TemplateSection {
    pub title: String,
    pub prompt: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CardType {
    pub id: String,
    /// Set for a subtype.
    pub parent_id: Option<String>,
    pub name: String,
    /// lucide icon name.
    pub icon: String,
    /// One of `COLORS`.
    pub color: String,
    pub guided_template: Vec<TemplateSection>,
    pub orientation: Orientation,
    pub canvas_format: CanvasFormat,
    pub sort_order: i32,
}

impl From<CardTypeRow> for CardType {
    fn from(row: CardTypeRow) -> Self {
        Self {
            // A template that cannot be read is shown empty rather than
            // making the whole type list fail.
            guided_template: serde_json::from_str(&row.guided_template).unwrap_or_default(),
            orientation: Orientation::parse(&row.orientation),
            canvas_format: CanvasFormat::parse(&row.canvas_format),
            sort_order: i32::try_from(row.sort_order).unwrap_or(i32::MAX),
            id: row.id,
            parent_id: row.parent_id,
            name: row.name,
            icon: row.icon,
            color: row.color,
        }
    }
}

#[derive(Debug, Clone, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct NewCardType {
    /// The type to create a subtype of, or `null` for a type.
    pub parent_id: Option<String>,
    pub name: String,
    pub icon: String,
    pub color: String,
}

/// Changes to a type; absent fields are left as is.
#[derive(Debug, Clone, Default, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct CardTypePatch {
    pub name: Option<String>,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub guided_template: Option<Vec<TemplateSection>>,
    pub orientation: Option<Orientation>,
    pub canvas_format: Option<CanvasFormat>,
}

fn validate_name(name: &str) -> AppResult<String> {
    let name = name.trim();
    if name.is_empty() {
        return Err(AppError::InvalidInput("a type name cannot be empty".into()));
    }
    if name.chars().count() > MAX_NAME_LEN {
        return Err(AppError::InvalidInput(format!(
            "a type name is at most {MAX_NAME_LEN} characters"
        )));
    }
    Ok(name.to_owned())
}

/// A lucide icon name: kebab-case ASCII. Which icons exist is the front's
/// business; this only keeps the value sane.
fn validate_icon(icon: &str) -> AppResult<String> {
    let valid = (1..=40).contains(&icon.len())
        && icon
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-');
    if valid {
        Ok(icon.to_owned())
    } else {
        Err(AppError::InvalidInput(format!("invalid icon name: {icon}")))
    }
}

fn validate_color(color: &str) -> AppResult<String> {
    if COLORS.contains(&color) {
        Ok(color.to_owned())
    } else {
        Err(AppError::InvalidInput(format!(
            "unknown type color: {color}"
        )))
    }
}

fn template_json(template: &[TemplateSection]) -> AppResult<String> {
    serde_json::to_string(template).map_err(|error| AppError::Internal(error.to_string()))
}

async fn row(pool: &SqlitePool, id: &str) -> AppResult<CardTypeRow> {
    queries::get(pool, id)
        .await?
        .ok_or_else(|| AppError::InvalidInput(format!("card type not found: {id}")))
}

// Used by the cards (M2 step 2.4).
#[cfg_attr(not(test), allow(dead_code))]
pub async fn get(pool: &SqlitePool, id: &str) -> AppResult<CardType> {
    Ok(row(pool, id).await?.into())
}

/// Every type, then each type's subtypes, in their order.
pub async fn list(pool: &SqlitePool) -> AppResult<Vec<CardType>> {
    let rows = queries::list(pool).await?;
    let (types, subtypes): (Vec<_>, Vec<_>) = rows.into_iter().partition(|r| r.parent_id.is_none());
    let mut ordered = Vec::with_capacity(types.len() + subtypes.len());
    for parent in types {
        let id = parent.id.clone();
        ordered.push(CardType::from(parent));
        ordered.extend(
            subtypes
                .iter()
                .filter(|sub| sub.parent_id.as_deref() == Some(id.as_str()))
                .cloned()
                .map(CardType::from),
        );
    }
    Ok(ordered)
}

async fn next_order(pool: &SqlitePool, parent_id: Option<&str>) -> AppResult<i64> {
    Ok(queries::siblings(pool, parent_id)
        .await?
        .iter()
        .map(|r| r.sort_order + 1)
        .max()
        .unwrap_or(0))
}

/// Checks that `parent_id` names a top-level type: subtypes have no subtypes.
async fn check_parent(pool: &SqlitePool, parent_id: Option<&str>) -> AppResult<()> {
    if let Some(parent) = parent_id
        && row(pool, parent).await?.parent_id.is_some()
    {
        return Err(AppError::InvalidInput(
            "a subtype cannot have subtypes".into(),
        ));
    }
    Ok(())
}

pub async fn create(pool: &SqlitePool, new: NewCardType) -> AppResult<CardType> {
    check_parent(pool, new.parent_id.as_deref()).await?;
    let row = CardTypeRow {
        id: Uuid::new_v4().to_string(),
        name: validate_name(&new.name)?,
        icon: validate_icon(&new.icon)?,
        color: validate_color(&new.color)?,
        guided_template: "[]".into(),
        orientation: Orientation::default().as_str().into(),
        canvas_format: CanvasFormat::default().as_str().into(),
        sort_order: next_order(pool, new.parent_id.as_deref()).await?,
        parent_id: new.parent_id,
        created_at: now(),
    };
    let mut tx = pool.begin().await?;
    queries::insert(&mut tx, &row).await?;
    tx.commit().await?;
    Ok(row.into())
}

pub async fn update(pool: &SqlitePool, id: &str, patch: CardTypePatch) -> AppResult<CardType> {
    let mut row = row(pool, id).await?;
    if let Some(name) = patch.name {
        row.name = validate_name(&name)?;
    }
    if let Some(icon) = patch.icon {
        row.icon = validate_icon(&icon)?;
    }
    if let Some(color) = patch.color {
        row.color = validate_color(&color)?;
    }
    if let Some(template) = patch.guided_template {
        row.guided_template = template_json(&template)?;
    }
    if let Some(orientation) = patch.orientation {
        row.orientation = orientation.as_str().into();
    }
    if let Some(format) = patch.canvas_format {
        row.canvas_format = format.as_str().into();
    }
    queries::update(pool, &row).await?;
    Ok(row.into())
}

/// Copies a type (with its subtypes) under `name`, after its siblings.
pub async fn duplicate(pool: &SqlitePool, id: &str, name: &str) -> AppResult<CardType> {
    let source = row(pool, id).await?;
    let copy = CardTypeRow {
        id: Uuid::new_v4().to_string(),
        name: validate_name(name)?,
        sort_order: next_order(pool, source.parent_id.as_deref()).await?,
        created_at: now(),
        ..source.clone()
    };
    let subtypes = queries::siblings(pool, Some(&source.id)).await?;
    let mut tx = pool.begin().await?;
    queries::insert(&mut tx, &copy).await?;
    for sub in subtypes {
        let sub_copy = CardTypeRow {
            id: Uuid::new_v4().to_string(),
            parent_id: Some(copy.id.clone()),
            created_at: copy.created_at.clone(),
            ..sub
        };
        queries::insert(&mut tx, &sub_copy).await?;
    }
    tx.commit().await?;
    Ok(copy.into())
}

/// Puts the types (or the subtypes of one type) in the order of `ids`,
/// which must list exactly the siblings of the first one.
pub async fn reorder(pool: &SqlitePool, ids: &[String]) -> AppResult<()> {
    let Some(first) = ids.first() else {
        return Ok(());
    };
    let parent = row(pool, first).await?.parent_id;
    let mut expected: Vec<String> = queries::siblings(pool, parent.as_deref())
        .await?
        .into_iter()
        .map(|r| r.id)
        .collect();
    let mut given = ids.to_vec();
    expected.sort();
    given.sort();
    if expected != given {
        return Err(AppError::InvalidInput(
            "reorder must list every sibling type exactly once".into(),
        ));
    }
    let mut tx = pool.begin().await?;
    for (order, id) in (0_i64..).zip(ids) {
        queries::set_order(&mut tx, id, order).await?;
    }
    tx.commit().await?;
    Ok(())
}

/// Deletes a type and its subtypes. Their cards (M2 step 2.4) move to
/// `move_cards_to`, which must be another type, not one being deleted.
pub async fn delete(pool: &SqlitePool, id: &str, move_cards_to: Option<&str>) -> AppResult<()> {
    row(pool, id).await?;
    if let Some(target) = move_cards_to {
        let target_row = row(pool, target).await?;
        if target == id || target_row.parent_id.as_deref() == Some(id) {
            return Err(AppError::InvalidInput(
                "cards cannot move to a type that is being deleted".into(),
            ));
        }
    }
    let mut tx = pool.begin().await?;
    queries::delete(&mut tx, id).await?;
    tx.commit().await?;
    Ok(())
}

/// Creates the default types of `genre`, named in `language`.
async fn seed(pool: &SqlitePool, genre: Genre, language: Language) -> AppResult<()> {
    let created_at = now();
    let mut tx = pool.begin().await?;
    for (order, default) in (0_i64..).zip(defaults::types_for(genre)) {
        let template: Vec<TemplateSection> = default
            .template
            .iter()
            .map(|section| TemplateSection {
                title: section.title.get(language).to_owned(),
                prompt: section.prompt.get(language).to_owned(),
            })
            .collect();
        let parent = CardTypeRow {
            id: Uuid::new_v4().to_string(),
            parent_id: None,
            name: default.name.get(language).to_owned(),
            icon: default.icon.to_owned(),
            color: default.color.to_owned(),
            guided_template: template_json(&template)?,
            orientation: Orientation::default().as_str().into(),
            canvas_format: CanvasFormat::default().as_str().into(),
            sort_order: order,
            created_at: created_at.clone(),
        };
        queries::insert(&mut tx, &parent).await?;
        if defaults::is_location(&default) {
            for (sub_order, name) in (0_i64..).zip(defaults::location_subtypes(genre)) {
                let sub = CardTypeRow {
                    id: Uuid::new_v4().to_string(),
                    parent_id: Some(parent.id.clone()),
                    name: name.get(language).to_owned(),
                    guided_template: "[]".into(),
                    sort_order: sub_order,
                    ..parent.clone()
                };
                queries::insert(&mut tx, &sub).await?;
            }
        }
    }
    queries::set_meta(&mut tx, SEEDED_KEY, &created_at).await?;
    tx.commit().await?;
    Ok(())
}

/// Creates the default types of the world's genre unless it already got
/// them once. Returns whether they were created. Deleting every type later
/// does not bring them back.
pub async fn ensure_defaults(
    pool: &SqlitePool,
    genre: Genre,
    language: Language,
) -> AppResult<bool> {
    if queries::meta(pool, SEEDED_KEY).await?.is_some() {
        return Ok(false);
    }
    seed(pool, genre, language).await?;
    Ok(true)
}
