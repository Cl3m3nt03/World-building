//! The wiki (docs/features/07-wiki.md, M8): which cards and maps have a
//! page, and the wiki's home page and style. The pages are the same
//! documents as in World: nothing is copied.

use std::collections::HashSet;

use serde::{Deserialize, Serialize};
use specta::Type;
use sqlx::SqlitePool;

use crate::db::wiki::{self as queries, SettingsRow};
use crate::domain::documents::DocumentKind;
use crate::error::{AppError, AppResult};

/// Longest wiki title and description.
pub const MAX_TITLE: usize = 200;
pub const MAX_DESCRIPTION: usize = 20_000;
/// Most cards on the home page.
pub const MAX_FEATURED: usize = 200;
/// Most palettes saved by the user.
pub const MAX_SAVED_PALETTES: usize = 50;

/// The colours of the wiki (CSS `#rrggbb`).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct WikiPalette {
    pub background: String,
    pub surface: String,
    pub text: String,
    pub muted: String,
    pub accent: String,
}

/// A palette the user saved under a name.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct NamedPalette {
    pub name: String,
    pub palette: WikiPalette,
}

/// The style of the wiki: a provided theme, maybe changed colour by colour,
/// and the fonts of the titles and of the text. Read with tolerance: a field
/// missing or unknown takes its default.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct WikiTheme {
    /// Key of a provided theme (the front knows them).
    pub preset: String,
    /// Colours changed from the preset's; `None`: the preset's.
    pub palette: Option<WikiPalette>,
    /// Font keys (the front knows them); `None`: the preset's.
    pub heading_font: Option<String>,
    pub body_font: Option<String>,
    pub saved_palettes: Vec<NamedPalette>,
}

impl Default for WikiTheme {
    fn default() -> Self {
        Self {
            preset: "parchment".into(),
            palette: None,
            heading_font: None,
            body_font: None,
            saved_palettes: Vec::new(),
        }
    }
}

/// The wiki's home page and style.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct WikiSettings {
    /// Empty: the world's name.
    pub title: String,
    pub description: String,
    pub banner_asset_id: Option<String>,
    /// Cards shown on the home page, in order.
    pub featured: Vec<String>,
    pub theme: WikiTheme,
}

/// A page of the wiki: a card or a map marked visible.
#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct WikiPage {
    pub id: String,
    pub kind: DocumentKind,
    pub title: String,
    /// For a card: its type and image.
    pub type_id: Option<String>,
    pub image_asset_id: Option<String>,
    /// For a card: its other names (the wiki's search finds them).
    pub aliases: Vec<String>,
}

fn invalid(message: impl Into<String>) -> AppError {
    AppError::InvalidInput(message.into())
}

fn is_color(value: &str) -> bool {
    value.len() == 7 && value.starts_with('#') && value[1..].chars().all(|c| c.is_ascii_hexdigit())
}

fn check_palette(palette: &WikiPalette) -> AppResult<()> {
    for color in [
        &palette.background,
        &palette.surface,
        &palette.text,
        &palette.muted,
        &palette.accent,
    ] {
        if !is_color(color) {
            return Err(invalid(format!("a wiki colour is #rrggbb: {color}")));
        }
    }
    Ok(())
}

fn check_key(what: &str, key: &str) -> AppResult<()> {
    if key.is_empty()
        || key.len() > 60
        || !key.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
    {
        return Err(invalid(format!("bad wiki {what}: {key}")));
    }
    Ok(())
}

/// Checks settings sent by the front: bounded texts and lists, colours,
/// keys, each featured card once.
pub fn check(settings: &WikiSettings) -> AppResult<()> {
    if settings.title.chars().count() > MAX_TITLE {
        return Err(invalid(format!(
            "a wiki title is at most {MAX_TITLE} characters"
        )));
    }
    if settings.description.chars().count() > MAX_DESCRIPTION {
        return Err(invalid(format!(
            "a wiki description is at most {MAX_DESCRIPTION} characters"
        )));
    }
    if let Some(banner) = &settings.banner_asset_id
        && (banner.is_empty() || banner.len() > 200)
    {
        return Err(invalid("a wiki banner needs an asset id"));
    }
    if settings.featured.len() > MAX_FEATURED {
        return Err(invalid(format!(
            "the wiki shows at most {MAX_FEATURED} cards"
        )));
    }
    let mut seen = HashSet::new();
    for id in &settings.featured {
        if id.is_empty() || id.len() > 100 || !seen.insert(id) {
            return Err(invalid(format!("bad featured card: {id}")));
        }
    }
    let theme = &settings.theme;
    check_key("theme", &theme.preset)?;
    for font in [&theme.heading_font, &theme.body_font]
        .into_iter()
        .flatten()
    {
        check_key("font", font)?;
    }
    if let Some(palette) = &theme.palette {
        check_palette(palette)?;
    }
    if theme.saved_palettes.len() > MAX_SAVED_PALETTES {
        return Err(invalid(format!(
            "at most {MAX_SAVED_PALETTES} saved palettes"
        )));
    }
    for saved in &theme.saved_palettes {
        let name = saved.name.trim();
        if name.is_empty() || name.chars().count() > 60 {
            return Err(invalid("a saved palette needs a name"));
        }
        check_palette(&saved.palette)?;
    }
    Ok(())
}

pub async fn settings(pool: &SqlitePool) -> AppResult<WikiSettings> {
    let row = queries::settings(pool).await?;
    Ok(WikiSettings {
        title: row.title,
        description: row.description,
        banner_asset_id: row.banner_asset_id,
        featured: serde_json::from_str(&row.featured).unwrap_or_default(),
        theme: serde_json::from_str(&row.theme).unwrap_or_else(|error| {
            tracing::warn!(%error, "unreadable wiki theme, using the default one");
            WikiTheme::default()
        }),
    })
}

/// Replaces the wiki's settings, once checked.
pub async fn save_settings(pool: &SqlitePool, settings: &WikiSettings) -> AppResult<()> {
    check(settings)?;
    let row = SettingsRow {
        title: settings.title.trim().to_owned(),
        description: settings.description.clone(),
        banner_asset_id: settings.banner_asset_id.clone(),
        featured: to_json(&settings.featured)?,
        theme: to_json(&settings.theme)?,
    };
    queries::save_settings(pool, &row).await
}

fn to_json<T: Serialize>(value: &T) -> AppResult<String> {
    serde_json::to_string(value).map_err(|error| AppError::Internal(format!("wiki json: {error}")))
}

/// Marks the card or map `id` visible in the wiki, or not.
pub async fn set_visible(pool: &SqlitePool, id: &str, visible: bool) -> AppResult<()> {
    if !queries::set_visible(pool, id, visible).await? {
        return Err(invalid(format!("no card or map to show in the wiki: {id}")));
    }
    Ok(())
}

/// The wiki's pages, by title.
pub async fn pages(pool: &SqlitePool) -> AppResult<Vec<WikiPage>> {
    queries::pages(pool)
        .await?
        .into_iter()
        .map(|row| {
            Ok(WikiPage {
                kind: DocumentKind::parse(&row.kind)?,
                aliases: row
                    .aliases
                    .as_deref()
                    .and_then(|json| serde_json::from_str(json).ok())
                    .unwrap_or_default(),
                id: row.id,
                title: row.title,
                type_id: row.type_id,
                image_asset_id: row.image_asset_id,
            })
        })
        .collect()
}

#[cfg(test)]
mod tests;
