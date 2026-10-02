//! Maps (docs/features/03-map.md, M4): an image of the media library with
//! layers, pins, zones and texts on it. Positions are relative to the image
//! (0 to 1). The front owns the editing and sends the whole content at each
//! save; this module checks it, stores it in one transaction and keeps the
//! `map_pin` links (pins and zones tied to a card) in step.

use serde::{Deserialize, Serialize};
use specta::Type;
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::db;
use crate::db::maps::{self as queries, LayerRow, MapRow, PinRow, TextRow, ZoneRow};
use crate::domain::documents::{self, DocumentKind};
use crate::domain::links::{self, LinkKind};
use crate::domain::tree;
use crate::error::{AppError, AppResult};

/// Most layers, and most pins, zones and texts, in one map.
pub const MAX_LAYERS: usize = 100;
pub const MAX_ITEMS: usize = 10_000;
/// Most vertices of a zone.
pub const MAX_POINTS: usize = 2_000;
/// Longest name, label or text, in characters.
pub const MAX_TEXT_LEN: usize = 1_000;
/// Longest short value (id, icon, color, font).
const MAX_SHORT_LEN: usize = 100;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct MapLayer {
    pub id: String,
    pub name: String,
    pub visible: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct MapPin {
    pub id: String,
    pub layer_id: String,
    /// The card the pin stands for; `null` for a plain marker.
    pub card_id: Option<String>,
    pub x: f64,
    pub y: f64,
    pub icon: String,
    pub color: String,
    pub label: String,
    /// Scale of the pin (1 is the default size).
    pub size: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum ZonePattern {
    Solid,
    Hatch,
    Dots,
    Cross,
}

impl ZonePattern {
    fn as_str(self) -> &'static str {
        match self {
            Self::Solid => "solid",
            Self::Hatch => "hatch",
            Self::Dots => "dots",
            Self::Cross => "cross",
        }
    }

    fn parse(value: &str) -> Self {
        match value {
            "hatch" => Self::Hatch,
            "dots" => Self::Dots,
            "cross" => Self::Cross,
            _ => Self::Solid,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LabelStyle {
    pub font: String,
    pub size: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct MapZone {
    pub id: String,
    pub layer_id: String,
    /// Vertices `[x, y]`, at least 3.
    pub points: Vec<[f64; 2]>,
    pub label: String,
    pub label_style: LabelStyle,
    pub card_id: Option<String>,
    pub fill_color: String,
    pub opacity: f64,
    pub pattern: ZonePattern,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct TextStyle {
    pub font: String,
    pub size: f64,
    /// Letter spacing, in em.
    pub spacing: f64,
    /// Bend of the text: 0 straight, positive arches up, negative down.
    pub arc: f64,
    /// The text grows and shrinks with the zoom.
    pub scale_with_zoom: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct MapText {
    pub id: String,
    pub layer_id: String,
    pub x: f64,
    pub y: f64,
    pub text: String,
    pub style: TextStyle,
}

/// What is drawn on a map, in display order (layers bottom to top).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct MapContent {
    pub layers: Vec<MapLayer>,
    pub pins: Vec<MapPin>,
    pub zones: Vec<MapZone>,
    pub texts: Vec<MapText>,
}

/// A map as seen by the front.
#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Map {
    pub id: String,
    pub title: String,
    /// `null` once the background image was deleted from the media library.
    pub background_asset_id: Option<String>,
    pub width: u32,
    pub height: u32,
    /// The background is cut into tiles (very large images, 4.3).
    pub tiled: bool,
    pub content: MapContent,
}

fn invalid(message: impl Into<String>) -> AppError {
    AppError::InvalidInput(message.into())
}

fn check_len(what: &str, value: &str, max: usize) -> AppResult<()> {
    if value.chars().count() > max {
        return Err(invalid(format!("{what} longer than {max} characters")));
    }
    Ok(())
}

fn check_id(what: &str, id: &str, seen: &mut std::collections::HashSet<String>) -> AppResult<()> {
    if id.is_empty() || id.len() > MAX_SHORT_LEN {
        return Err(invalid(format!("{what} needs an id")));
    }
    if !seen.insert(id.to_owned()) {
        return Err(invalid(format!("{what} id used twice: {id}")));
    }
    Ok(())
}

fn check_position(what: &str, x: f64, y: f64) -> AppResult<()> {
    if !(0.0..=1.0).contains(&x) || !(0.0..=1.0).contains(&y) {
        return Err(invalid(format!("{what} outside the map: {x}, {y}")));
    }
    Ok(())
}

fn check_range(what: &str, value: f64, min: f64, max: f64) -> AppResult<()> {
    if !(min..=max).contains(&value) {
        return Err(invalid(format!(
            "{what} must be between {min} and {max}: {value}"
        )));
    }
    Ok(())
}

/// Checks a content sent by the front: unique ids, known layers, positions
/// on the map, zones of 3 vertices at least, bounded sizes.
pub fn check(content: &MapContent) -> AppResult<()> {
    if content.layers.is_empty() || content.layers.len() > MAX_LAYERS {
        return Err(invalid(format!(
            "a map has between 1 and {MAX_LAYERS} layers"
        )));
    }
    if content.pins.len() + content.zones.len() + content.texts.len() > MAX_ITEMS {
        return Err(invalid(format!("a map holds at most {MAX_ITEMS} items")));
    }
    let mut ids = std::collections::HashSet::new();
    for layer in &content.layers {
        check_id("layer", &layer.id, &mut ids)?;
        check_len("layer name", &layer.name, MAX_TEXT_LEN)?;
    }
    let layer_ids: Vec<&str> = content
        .layers
        .iter()
        .map(|layer| layer.id.as_str())
        .collect();
    let known_layer = |id: &str| {
        if layer_ids.contains(&id) {
            Ok(())
        } else {
            Err(invalid(format!("unknown layer: {id}")))
        }
    };
    for pin in &content.pins {
        check_id("pin", &pin.id, &mut ids)?;
        known_layer(&pin.layer_id)?;
        check_position("pin", pin.x, pin.y)?;
        check_range("pin size", pin.size, 0.25, 8.0)?;
        check_len("pin label", &pin.label, MAX_TEXT_LEN)?;
        check_len("pin icon", &pin.icon, MAX_SHORT_LEN)?;
        check_len("pin color", &pin.color, MAX_SHORT_LEN)?;
    }
    for zone in &content.zones {
        check_id("zone", &zone.id, &mut ids)?;
        known_layer(&zone.layer_id)?;
        if zone.points.len() < 3 || zone.points.len() > MAX_POINTS {
            return Err(invalid(format!(
                "a zone has between 3 and {MAX_POINTS} vertices"
            )));
        }
        for [x, y] in &zone.points {
            check_position("zone vertex", *x, *y)?;
        }
        check_range("zone opacity", zone.opacity, 0.0, 1.0)?;
        check_range("zone label size", zone.label_style.size, 4.0, 400.0)?;
        check_len("zone label", &zone.label, MAX_TEXT_LEN)?;
        check_len("zone font", &zone.label_style.font, MAX_SHORT_LEN)?;
        check_len("zone color", &zone.fill_color, MAX_SHORT_LEN)?;
    }
    for text in &content.texts {
        check_id("text", &text.id, &mut ids)?;
        known_layer(&text.layer_id)?;
        check_position("text", text.x, text.y)?;
        check_len("text", &text.text, MAX_TEXT_LEN)?;
        check_len("text font", &text.style.font, MAX_SHORT_LEN)?;
        check_range("text size", text.style.size, 4.0, 400.0)?;
        check_range("letter spacing", text.style.spacing, -1.0, 5.0)?;
        check_range("text arc", text.style.arc, -1.0, 1.0)?;
    }
    Ok(())
}

/// The content of a new map: one layer.
fn new_content(layer_name: &str) -> MapContent {
    MapContent {
        layers: vec![MapLayer {
            id: Uuid::new_v4().to_string(),
            name: layer_name.to_owned(),
            visible: true,
        }],
        pins: Vec::new(),
        zones: Vec::new(),
        texts: Vec::new(),
    }
}

/// Pixel size of an image of the media library, which must be an image.
async fn image_size(pool: &SqlitePool, asset_id: &str) -> AppResult<(i64, i64)> {
    let asset = db::assets::get(pool, asset_id)
        .await?
        .ok_or_else(|| invalid(format!("asset not found: {asset_id}")))?;
    match (asset.kind.as_str(), asset.width, asset.height) {
        ("image", Some(width), Some(height)) if width > 0 && height > 0 => Ok((width, height)),
        _ => Err(invalid(format!(
            "a map background is an image of known size: {asset_id}"
        ))),
    }
}

/// Creates a map named `title` on the image `background_asset_id`, with one
/// layer named `layer_name` (translated by the front).
pub async fn create(
    pool: &SqlitePool,
    title: &str,
    background_asset_id: &str,
    layer_name: &str,
) -> AppResult<Map> {
    let (width, height) = image_size(pool, background_asset_id).await?;
    let mut tx = db::begin_write(pool).await?;
    let document = documents::create_in(&mut tx, DocumentKind::Map, title).await?;
    queries::insert(
        &mut tx,
        &document.id,
        Some(background_asset_id),
        width,
        height,
    )
    .await?;
    write_content(&mut tx, &document.id, &new_content(layer_name)).await?;
    tx.commit().await?;
    get(pool, &document.id).await
}

pub async fn get(pool: &SqlitePool, id: &str) -> AppResult<Map> {
    let row: MapRow = queries::get(pool, id)
        .await?
        .ok_or_else(|| invalid(format!("map not found: {id}")))?;
    let layers = queries::layers(pool, id)
        .await?
        .into_iter()
        .map(|layer| MapLayer {
            id: layer.id,
            name: layer.name,
            visible: layer.visible,
        })
        .collect();
    let pins = queries::pins(pool, id)
        .await?
        .into_iter()
        .map(|pin| MapPin {
            id: pin.id,
            layer_id: pin.layer_id,
            card_id: pin.card_id,
            x: pin.x,
            y: pin.y,
            icon: pin.icon,
            color: pin.color,
            label: pin.label,
            size: pin.size,
        })
        .collect();
    let mut zones = Vec::new();
    for zone in queries::zones(pool, id).await? {
        zones.push(MapZone {
            points: serde_json::from_str(&zone.points)
                .map_err(|error| AppError::Internal(format!("zone points: {error}")))?,
            label_style: serde_json::from_str(&zone.label_style)
                .map_err(|error| AppError::Internal(format!("zone label style: {error}")))?,
            pattern: ZonePattern::parse(&zone.pattern),
            id: zone.id,
            layer_id: zone.layer_id,
            label: zone.label,
            card_id: zone.card_id,
            fill_color: zone.fill_color,
            opacity: zone.opacity,
        });
    }
    let mut texts = Vec::new();
    for text in queries::texts(pool, id).await? {
        texts.push(MapText {
            style: serde_json::from_str(&text.style)
                .map_err(|error| AppError::Internal(format!("text style: {error}")))?,
            id: text.id,
            layer_id: text.layer_id,
            x: text.x,
            y: text.y,
            text: text.text,
        });
    }
    Ok(Map {
        id: row.document_id,
        title: row.title,
        background_asset_id: row.background_asset_id,
        width: u32::try_from(row.width).unwrap_or(1),
        height: u32::try_from(row.height).unwrap_or(1),
        tiled: row.tiles_path.is_some(),
        content: MapContent {
            layers,
            pins,
            zones,
            texts,
        },
    })
}

fn to_json<T: Serialize>(value: &T) -> AppResult<String> {
    serde_json::to_string(value).map_err(|error| AppError::Internal(format!("map json: {error}")))
}

/// Replaces the map's content in `tx`, and its `map_pin` links.
async fn write_content(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    map_id: &str,
    content: &MapContent,
) -> AppResult<()> {
    queries::clear(tx, map_id).await?;
    for (order, layer) in content.layers.iter().enumerate() {
        let row = LayerRow {
            id: layer.id.clone(),
            name: layer.name.clone(),
            visible: layer.visible,
        };
        queries::insert_layer(tx, map_id, &row, order as i64).await?;
    }
    for (order, pin) in content.pins.iter().enumerate() {
        let row = PinRow {
            id: pin.id.clone(),
            layer_id: pin.layer_id.clone(),
            card_id: pin.card_id.clone(),
            x: pin.x,
            y: pin.y,
            icon: pin.icon.clone(),
            color: pin.color.clone(),
            label: pin.label.clone(),
            size: pin.size,
        };
        queries::insert_pin(tx, map_id, &row, order as i64).await?;
    }
    for (order, zone) in content.zones.iter().enumerate() {
        let row = ZoneRow {
            id: zone.id.clone(),
            layer_id: zone.layer_id.clone(),
            points: to_json(&zone.points)?,
            label: zone.label.clone(),
            label_style: to_json(&zone.label_style)?,
            card_id: zone.card_id.clone(),
            fill_color: zone.fill_color.clone(),
            opacity: zone.opacity,
            pattern: zone.pattern.as_str().to_owned(),
        };
        queries::insert_zone(tx, map_id, &row, order as i64).await?;
    }
    for (order, text) in content.texts.iter().enumerate() {
        let row = TextRow {
            id: text.id.clone(),
            layer_id: text.layer_id.clone(),
            x: text.x,
            y: text.y,
            text: text.text.clone(),
            style: to_json(&text.style)?,
        };
        queries::insert_text(tx, map_id, &row, order as i64).await?;
    }
    // Pins and zones tied to a card are links from the map, once each.
    let mut cards: Vec<String> = Vec::new();
    let tied = content
        .pins
        .iter()
        .filter_map(|pin| pin.card_id.as_ref())
        .chain(
            content
                .zones
                .iter()
                .filter_map(|zone| zone.card_id.as_ref()),
        );
    for card in tied {
        if card != map_id && !cards.contains(card) {
            cards.push(card.clone());
        }
    }
    links::replace_in(tx, map_id, LinkKind::MapPin, None, &cards).await
}

/// Replaces the content of the map `id` with `content`, once checked.
pub async fn save(pool: &SqlitePool, id: &str, content: &MapContent) -> AppResult<()> {
    check(content)?;
    queries::get(pool, id)
        .await?
        .ok_or_else(|| invalid(format!("map not found: {id}")))?;
    let mut tx = db::begin_write(pool).await?;
    write_content(&mut tx, id, content).await?;
    db::documents::touch(&mut tx, id, &documents::now()).await?;
    tx.commit().await?;
    Ok(())
}

/// Puts the image `asset_id` under the map; what is on it keeps its place
/// (positions are relative to the image).
pub async fn set_background(pool: &SqlitePool, id: &str, asset_id: &str) -> AppResult<Map> {
    let (width, height) = image_size(pool, asset_id).await?;
    if !queries::set_background(pool, id, asset_id, width, height).await? {
        return Err(invalid(format!("map not found: {id}")));
    }
    get(pool, id).await
}

/// Duplicates the map `id` as `title`: same background and content (new
/// ids), placed right after it.
pub async fn duplicate(pool: &SqlitePool, id: &str, title: &str) -> AppResult<Map> {
    let map = get(pool, id).await?;
    let mut content = map.content;
    let mut renamed = std::collections::HashMap::new();
    for layer in &mut content.layers {
        let new = Uuid::new_v4().to_string();
        renamed.insert(std::mem::replace(&mut layer.id, new.clone()), new);
    }
    let layer_of = |old: &str| renamed.get(old).cloned().unwrap_or_default();
    for pin in &mut content.pins {
        pin.id = Uuid::new_v4().to_string();
        pin.layer_id = layer_of(&pin.layer_id);
    }
    for zone in &mut content.zones {
        zone.id = Uuid::new_v4().to_string();
        zone.layer_id = layer_of(&zone.layer_id);
    }
    for text in &mut content.texts {
        text.id = Uuid::new_v4().to_string();
        text.layer_id = layer_of(&text.layer_id);
    }
    let mut tx = db::begin_write(pool).await?;
    let document = documents::create_in(&mut tx, DocumentKind::Map, title).await?;
    queries::insert(
        &mut tx,
        &document.id,
        map.background_asset_id.as_deref(),
        i64::from(map.width),
        i64::from(map.height),
    )
    .await?;
    write_content(&mut tx, &document.id, &content).await?;
    tree::place_after(&mut tx, id, &document.id).await?;
    tx.commit().await?;
    get(pool, &document.id).await
}

#[cfg(test)]
mod tests;
