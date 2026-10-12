//! The world's timelines (docs/features/09-frise.md, M11, ADR 0011): a
//! document made of tracks, with events (a date) and periods (two dates) on
//! them. Dates are whole days from the year 0 of the world's calendar, with
//! their precision. An item standing for a card makes the timeline cite it.

use serde::{Deserialize, Serialize};
use specta::Type;
use sqlx::{Sqlite, SqlitePool, Transaction};
use uuid::Uuid;

use crate::db;
use crate::db::timelines::{self as queries, ItemRow, TrackRow};
use crate::domain::documents::{self, DocumentKind, now, validate_title};
use crate::domain::links::{self, LinkKind};
use crate::error::{AppError, AppResult};

/// Longest track name and item title, in characters.
pub const MAX_NAME: usize = 120;
/// Longest item description, in characters.
pub const MAX_DESCRIPTION: usize = 4000;
/// Most tracks a timeline holds.
pub const MAX_TRACKS: usize = 50;
/// The colour keys a track or an item may take (the card types' palette).
pub const COLORS: [&str; 9] = [
    "red", "orange", "amber", "green", "teal", "blue", "violet", "pink", "slate",
];

/// What the date of an item names.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum DatePrecision {
    Year,
    Month,
    Day,
}

impl DatePrecision {
    fn as_str(self) -> &'static str {
        match self {
            Self::Year => "year",
            Self::Month => "month",
            Self::Day => "day",
        }
    }

    fn parse(value: &str) -> Self {
        match value {
            "month" => Self::Month,
            "day" => Self::Day,
            _ => Self::Year,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct TimelineTrack {
    pub id: String,
    pub name: String,
    pub color: String,
}

/// An event (`end` none) or a period, on a track.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct TimelineItem {
    pub id: String,
    pub track_id: String,
    /// The card the item stands for.
    pub card_id: Option<String>,
    pub title: String,
    pub color: String,
    pub description: String,
    /// Days from the year 0 of the world's calendar.
    pub start: i32,
    /// For a period: its last day (not before `start`).
    pub end: Option<i32>,
    pub precision: DatePrecision,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Timeline {
    pub id: String,
    pub title: String,
    /// In order, from the top.
    pub tracks: Vec<TimelineTrack>,
    /// In time order.
    pub items: Vec<TimelineItem>,
}

fn invalid(message: impl Into<String>) -> AppError {
    AppError::InvalidInput(message.into())
}

fn check_name(name: &str, what: &str) -> AppResult<String> {
    let name = name.trim();
    if name.chars().count() > MAX_NAME {
        return Err(invalid(format!("{what} has at most {MAX_NAME} characters")));
    }
    Ok(name.to_owned())
}

fn check_color(color: &str) -> AppResult<()> {
    if COLORS.contains(&color) {
        Ok(())
    } else {
        Err(invalid(format!("unknown colour: {color}")))
    }
}

fn day(value: i64) -> i32 {
    i32::try_from(value).unwrap_or(if value < 0 { i32::MIN } else { i32::MAX })
}

fn item_of(row: ItemRow) -> TimelineItem {
    TimelineItem {
        id: row.id,
        track_id: row.track_id,
        card_id: row.card_id,
        title: row.title,
        color: row.color,
        description: row.description,
        start: day(row.start_day),
        end: row.end_day.map(day),
        precision: DatePrecision::parse(&row.precision),
    }
}

/// The timeline `id` with its tracks and items.
pub async fn get(pool: &SqlitePool, id: &str) -> AppResult<Timeline> {
    let title = queries::title(pool, id)
        .await?
        .ok_or_else(|| invalid(format!("timeline not found: {id}")))?;
    let tracks = queries::tracks(pool, id)
        .await?
        .into_iter()
        .map(|row| TimelineTrack {
            id: row.id,
            name: row.name,
            color: row.color,
        })
        .collect();
    let items = queries::items(pool, id)
        .await?
        .into_iter()
        .map(item_of)
        .collect();
    Ok(Timeline {
        id: id.to_owned(),
        title,
        tracks,
        items,
    })
}

/// The cards the timeline's items stand for are the targets of its links.
async fn relink(tx: &mut Transaction<'_, Sqlite>, timeline_id: &str) -> AppResult<()> {
    let mut cards: Vec<String> = queries::items(&mut **tx, timeline_id)
        .await?
        .into_iter()
        .filter_map(|item| item.card_id)
        .collect();
    cards.sort();
    cards.dedup();
    links::replace_in(tx, timeline_id, LinkKind::Timeline, None, &cards).await?;
    db::documents::touch(tx, timeline_id, &now()).await
}

async fn track_of(tx: &mut Transaction<'_, Sqlite>, id: &str) -> AppResult<TrackRow> {
    queries::track(&mut **tx, id)
        .await?
        .ok_or_else(|| invalid(format!("track not found: {id}")))
}

/// Creates a timeline named `title` with one track named `track_name` (both
/// translated by the front).
pub async fn create(pool: &SqlitePool, title: &str, track_name: &str) -> AppResult<Timeline> {
    let title = validate_title(title)?;
    let track_name = check_name(track_name, "a track's name")?;
    let mut tx = db::begin_write(pool).await?;
    let document = documents::create_in(&mut tx, DocumentKind::Timeline, &title).await?;
    queries::insert(&mut *tx, &document.id).await?;
    queries::insert_track(
        &mut *tx,
        &TrackRow {
            id: Uuid::new_v4().to_string(),
            timeline_id: document.id.clone(),
            name: track_name,
            color: "slate".to_owned(),
            sort_order: 0,
        },
    )
    .await?;
    tx.commit().await?;
    get(pool, &document.id).await
}

pub async fn add_track(
    pool: &SqlitePool,
    timeline_id: &str,
    name: &str,
    color: &str,
) -> AppResult<Timeline> {
    let name = check_name(name, "a track's name")?;
    check_color(color)?;
    let mut tx = db::begin_write(pool).await?;
    if queries::title(&mut *tx, timeline_id).await?.is_none() {
        return Err(invalid(format!("timeline not found: {timeline_id}")));
    }
    let tracks = queries::tracks(&mut *tx, timeline_id).await?;
    if tracks.len() >= MAX_TRACKS {
        return Err(invalid(format!(
            "a timeline holds at most {MAX_TRACKS} tracks"
        )));
    }
    queries::insert_track(
        &mut *tx,
        &TrackRow {
            id: Uuid::new_v4().to_string(),
            timeline_id: timeline_id.to_owned(),
            name,
            color: color.to_owned(),
            sort_order: i64::try_from(tracks.len()).unwrap_or(i64::MAX),
        },
    )
    .await?;
    db::documents::touch(&mut tx, timeline_id, &now()).await?;
    tx.commit().await?;
    get(pool, timeline_id).await
}

pub async fn update_track(
    pool: &SqlitePool,
    id: &str,
    name: &str,
    color: &str,
) -> AppResult<Timeline> {
    let name = check_name(name, "a track's name")?;
    check_color(color)?;
    let mut tx = db::begin_write(pool).await?;
    let track = track_of(&mut tx, id).await?;
    queries::update_track(&mut *tx, id, &name, color).await?;
    db::documents::touch(&mut tx, &track.timeline_id, &now()).await?;
    tx.commit().await?;
    get(pool, &track.timeline_id).await
}

/// Moves a track to `index` among its timeline's.
pub async fn move_track(pool: &SqlitePool, id: &str, index: u32) -> AppResult<Timeline> {
    let mut tx = db::begin_write(pool).await?;
    let track = track_of(&mut tx, id).await?;
    let mut ids: Vec<String> = queries::tracks(&mut *tx, &track.timeline_id)
        .await?
        .into_iter()
        .map(|row| row.id)
        .filter(|other| other != id)
        .collect();
    let at = usize::try_from(index).unwrap_or(usize::MAX).min(ids.len());
    ids.insert(at, id.to_owned());
    for (order, track_id) in ids.iter().enumerate() {
        queries::set_track_order(&mut *tx, track_id, i64::try_from(order).unwrap_or(i64::MAX))
            .await?;
    }
    db::documents::touch(&mut tx, &track.timeline_id, &now()).await?;
    tx.commit().await?;
    get(pool, &track.timeline_id).await
}

/// Deletes a track and its items; a timeline keeps at least one track.
pub async fn delete_track(pool: &SqlitePool, id: &str) -> AppResult<Timeline> {
    let mut tx = db::begin_write(pool).await?;
    let track = track_of(&mut tx, id).await?;
    if queries::tracks(&mut *tx, &track.timeline_id).await?.len() <= 1 {
        return Err(invalid("a timeline keeps at least one track"));
    }
    queries::delete_track(&mut *tx, id).await?;
    relink(&mut tx, &track.timeline_id).await?;
    tx.commit().await?;
    get(pool, &track.timeline_id).await
}

/// Adds the item (a new id) or changes it (an existing one), once checked.
pub async fn save_item(pool: &SqlitePool, item: &TimelineItem) -> AppResult<Timeline> {
    let title = check_name(&item.title, "an item's title")?;
    check_color(&item.color)?;
    if item.description.chars().count() > MAX_DESCRIPTION {
        return Err(invalid(format!(
            "a description has at most {MAX_DESCRIPTION} characters"
        )));
    }
    if item.end.is_some_and(|end| end < item.start) {
        return Err(invalid("a period cannot end before it starts"));
    }
    if Uuid::parse_str(&item.id).is_err() {
        return Err(invalid(format!("invalid item id: {}", item.id)));
    }
    if let Some(card) = &item.card_id
        && !queries::is_card(pool, card).await?
    {
        return Err(invalid(format!("card not found: {card}")));
    }
    let mut tx = db::begin_write(pool).await?;
    let track = track_of(&mut tx, &item.track_id).await?;
    let existing = queries::item(&mut *tx, &item.id).await?;
    // An item moves between the tracks of its own timeline only.
    let old_timeline = match &existing {
        Some(row) => Some(track_of(&mut tx, &row.track_id).await?.timeline_id),
        None => None,
    };
    if old_timeline
        .as_ref()
        .is_some_and(|old| *old != track.timeline_id)
    {
        return Err(invalid("an item stays on its timeline"));
    }
    let now = now();
    queries::upsert_item(
        &mut *tx,
        &ItemRow {
            id: item.id.clone(),
            track_id: item.track_id.clone(),
            card_id: item.card_id.clone(),
            title,
            color: item.color.clone(),
            description: item.description.clone(),
            start_day: i64::from(item.start),
            end_day: item.end.map(i64::from),
            precision: item.precision.as_str().to_owned(),
            created_at: existing.map_or_else(|| now.clone(), |row| row.created_at),
            updated_at: now,
        },
    )
    .await?;
    relink(&mut tx, &track.timeline_id).await?;
    tx.commit().await?;
    get(pool, &track.timeline_id).await
}

pub async fn delete_item(pool: &SqlitePool, id: &str) -> AppResult<Timeline> {
    let mut tx = db::begin_write(pool).await?;
    let row = queries::item(&mut *tx, id)
        .await?
        .ok_or_else(|| invalid(format!("item not found: {id}")))?;
    let track = track_of(&mut tx, &row.track_id).await?;
    queries::delete_item(&mut *tx, id).await?;
    relink(&mut tx, &track.timeline_id).await?;
    tx.commit().await?;
    get(pool, &track.timeline_id).await
}

#[cfg(test)]
mod tests;
