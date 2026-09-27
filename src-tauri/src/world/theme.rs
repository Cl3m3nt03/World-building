//! Visual theme of a world (ADR 0004), saved in `world.json`: the app's
//! default look, one of the themes shipped with the app, or the user's own
//! (background image from the media library, accent color).

use serde::{Deserialize, Deserializer, Serialize};
use specta::Type;

use crate::error::{AppError, AppResult};

/// Longest id of a shipped theme.
const MAX_PRESET_ID_LEN: usize = 40;

#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum WorldTheme {
    /// The app's look: the main image as background, the ochre accent.
    #[default]
    Default,
    /// A theme shipped with the app, by id (`dawn`, `forest`…). The front
    /// shows an id it does not know as the default theme.
    Preset { id: String },
    /// The user's own theme.
    Custom {
        /// Asset id of the background image; `None`: the main image.
        background: Option<String>,
        /// Accent color, `#rrggbb` in lower case.
        accent: String,
    },
}

impl WorldTheme {
    pub fn is_default(&self) -> bool {
        *self == Self::Default
    }

    /// The background asset of a custom theme, if any.
    pub fn background(&self) -> Option<&str> {
        match self {
            Self::Custom {
                background: Some(id),
                ..
            } => Some(id),
            _ => None,
        }
    }

    /// Checks the shape of the theme (not whether its background exists)
    /// and returns it with the accent in lower case.
    pub fn validated(self) -> AppResult<Self> {
        match self {
            Self::Default => Ok(Self::Default),
            Self::Preset { id } => {
                let valid = !id.is_empty()
                    && id.len() <= MAX_PRESET_ID_LEN
                    && id
                        .chars()
                        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-');
                if valid {
                    Ok(Self::Preset { id })
                } else {
                    Err(AppError::InvalidInput(format!("invalid theme id: {id:?}")))
                }
            }
            Self::Custom { background, accent } => {
                let hex = accent.strip_prefix('#').unwrap_or_default();
                if hex.len() != 6 || !hex.chars().all(|c| c.is_ascii_hexdigit()) {
                    return Err(AppError::InvalidInput(format!(
                        "invalid accent color: {accent:?}"
                    )));
                }
                Ok(Self::Custom {
                    background,
                    accent: accent.to_ascii_lowercase(),
                })
            }
        }
    }
}

/// Reads the `theme` of `world.json` tolerantly: a theme this app cannot
/// read (edited by hand, or from a newer app) gives the default theme
/// instead of refusing to open the world.
pub fn deserialize_lenient<'de, D>(deserializer: D) -> Result<WorldTheme, D::Error>
where
    D: Deserializer<'de>,
{
    let value = serde_json::Value::deserialize(deserializer)?;
    Ok(serde_json::from_value::<WorldTheme>(value.clone())
        .map_err(|error| error.to_string())
        .and_then(|theme| theme.validated().map_err(|error| error.to_string()))
        .unwrap_or_else(|error| {
            tracing::warn!(%error, %value, "unreadable world theme, using the default one");
            WorldTheme::Default
        }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn custom(accent: &str) -> WorldTheme {
        WorldTheme::Custom {
            background: None,
            accent: accent.into(),
        }
    }

    #[test]
    fn validation_accepts_well_formed_themes() {
        assert_eq!(
            WorldTheme::Default.validated().unwrap(),
            WorldTheme::Default
        );
        let preset = WorldTheme::Preset { id: "dawn".into() };
        assert_eq!(preset.clone().validated().unwrap(), preset);
        assert_eq!(custom("#C8912E").validated().unwrap(), custom("#c8912e"));
    }

    #[test]
    fn validation_refuses_malformed_themes() {
        for theme in [
            WorldTheme::Preset { id: String::new() },
            WorldTheme::Preset {
                id: "../dawn".into(),
            },
            WorldTheme::Preset {
                id: "a".repeat(MAX_PRESET_ID_LEN + 1),
            },
            custom("c8912e"),
            custom("#c8912"),
            custom("#gggggg"),
            custom("red"),
        ] {
            assert!(
                matches!(theme.clone().validated(), Err(AppError::InvalidInput(_))),
                "{theme:?}"
            );
        }
    }

    #[derive(Deserialize)]
    struct Holder {
        #[serde(default, deserialize_with = "deserialize_lenient")]
        theme: WorldTheme,
    }

    fn read(json: &str) -> WorldTheme {
        serde_json::from_str::<Holder>(json).unwrap().theme
    }

    #[test]
    fn reading_is_tolerant() {
        assert_eq!(read("{}"), WorldTheme::Default);
        assert_eq!(
            read(r#"{"theme":{"kind":"preset","id":"forest"}}"#),
            WorldTheme::Preset {
                id: "forest".into()
            }
        );
        assert_eq!(
            read(r##"{"theme":{"kind":"custom","background":null,"accent":"#5FCDC0"}}"##),
            custom("#5fcdc0")
        );
        // Unknown kind, missing fields, bad color, wrong type: the default theme.
        for json in [
            r#"{"theme":{"kind":"animated","speed":2}}"#,
            r#"{"theme":{"kind":"custom"}}"#,
            r#"{"theme":{"kind":"custom","background":null,"accent":"blue"}}"#,
            r#"{"theme":"dawn"}"#,
            r#"{"theme":null}"#,
        ] {
            assert_eq!(read(json), WorldTheme::Default, "{json}");
        }
    }
}
