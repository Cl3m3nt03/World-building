//! The reading settings of a story (M10, ADR 0010): how the book looks in the
//! reading preview and in the exports. Stored as JSON on the story and read
//! with tolerance: a missing or unknown value takes its default.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use specta::Type;
use sqlx::SqlitePool;

use super::{invalid, to_json};
use crate::db::quill as queries;
use crate::error::AppResult;

/// Slowest and fastest reading speeds, in words per minute.
pub const MIN_WORDS_PER_MINUTE: u32 = 60;
pub const MAX_WORDS_PER_MINUTE: u32 = 600;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum PageTheme {
    Light,
    Dark,
    Sepia,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum ReadingMode {
    /// One long page that scrolls.
    Scroll,
    /// Pages turned one by one.
    Pages,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum TextSize {
    Small,
    Medium,
    Large,
}

/// Where a chapter's header image goes.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum ChapterLayout {
    /// The image, then the title under it.
    ImageAbove,
    /// The title written over the image.
    TitleOver,
    /// The title alone, without the image.
    NoImage,
}

/// How a story reads.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ReaderSettings {
    pub theme: PageTheme,
    pub mode: ReadingMode,
    /// CSS `#rrggbb`, or None for the theme's own page colour.
    pub background: Option<String>,
    /// A font key of the app's free fonts (as for the wiki).
    pub font: String,
    pub text_size: TextSize,
    pub chapter_layout: ChapterLayout,
    /// The pace of the reading with sound (« Lecture »).
    pub words_per_minute: u32,
}

impl Default for ReaderSettings {
    fn default() -> Self {
        Self {
            theme: PageTheme::Light,
            mode: ReadingMode::Scroll,
            background: None,
            font: "garamond".to_owned(),
            text_size: TextSize::Medium,
            chapter_layout: ChapterLayout::ImageAbove,
            words_per_minute: 200,
        }
    }
}

fn is_color(value: &str) -> bool {
    value
        .strip_prefix('#')
        .is_some_and(|hex| hex.len() == 6 && hex.chars().all(|c| c.is_ascii_hexdigit()))
}

fn is_font_key(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 40
        && value
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

/// Stored settings, read with tolerance.
pub fn read_settings(json: &str) -> ReaderSettings {
    let value: Value = serde_json::from_str(json).unwrap_or_default();
    let default = ReaderSettings::default();
    fn field<T: for<'de> Deserialize<'de>>(value: &Value, key: &str) -> Option<T> {
        value
            .get(key)
            .and_then(|field| serde_json::from_value(field.clone()).ok())
    }
    ReaderSettings {
        theme: field(&value, "theme").unwrap_or(default.theme),
        mode: field(&value, "mode").unwrap_or(default.mode),
        background: field::<String>(&value, "background").filter(|color| is_color(color)),
        font: field::<String>(&value, "font")
            .filter(|font| is_font_key(font))
            .unwrap_or(default.font),
        text_size: field(&value, "textSize").unwrap_or(default.text_size),
        chapter_layout: field(&value, "chapterLayout").unwrap_or(default.chapter_layout),
        words_per_minute: field::<u32>(&value, "wordsPerMinute")
            .map(|speed| speed.clamp(MIN_WORDS_PER_MINUTE, MAX_WORDS_PER_MINUTE))
            .unwrap_or(default.words_per_minute),
    }
}

fn check(settings: &ReaderSettings) -> AppResult<()> {
    if let Some(color) = &settings.background
        && !is_color(color)
    {
        return Err(invalid(format!("a page background is #rrggbb: {color}")));
    }
    if !is_font_key(&settings.font) {
        return Err(invalid(format!("invalid font key: {:?}", settings.font)));
    }
    if !(MIN_WORDS_PER_MINUTE..=MAX_WORDS_PER_MINUTE).contains(&settings.words_per_minute) {
        return Err(invalid(format!(
            "a reading speed is {MIN_WORDS_PER_MINUTE} to {MAX_WORDS_PER_MINUTE} words per minute"
        )));
    }
    Ok(())
}

pub async fn reader_settings(pool: &SqlitePool, story_id: &str) -> AppResult<ReaderSettings> {
    let json = queries::reader_settings(pool, story_id)
        .await?
        .ok_or_else(|| invalid(format!("story not found: {story_id}")))?;
    Ok(read_settings(&json))
}

pub async fn save_reader_settings(
    pool: &SqlitePool,
    story_id: &str,
    settings: &ReaderSettings,
) -> AppResult<ReaderSettings> {
    check(settings)?;
    if !queries::save_reader_settings(pool, story_id, &to_json(settings)?).await? {
        return Err(invalid(format!("story not found: {story_id}")));
    }
    Ok(settings.clone())
}
