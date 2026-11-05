//! Visual theme of a world (ADR 0004, 0015), saved in `world.json`: the
//! app's default look, one of the themes shipped with the app, or the user's
//! own (background image from the media library, accent color, and the
//! material, ornament, heading font and color scheme picked from closed lists).

use serde::de::DeserializeOwned;
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use specta::Type;

use crate::error::{AppError, AppResult};

/// Longest id of a shipped theme.
const MAX_PRESET_ID_LEN: usize = 40;

#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize, Type)]
#[serde(
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    tag = "kind"
)]
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
        /// Material of the panels. Absent: vellum.
        #[serde(default)]
        #[specta(optional)]
        material: Material,
        /// Ornament of the panels. Absent: none.
        #[serde(default)]
        #[specta(optional)]
        ornament: Ornament,
        /// Font of the headings. Absent: Alegreya.
        #[serde(default)]
        #[specta(optional)]
        heading_font: HeadingFont,
        /// Light or dark mode while the world is open. Absent: the app's.
        #[serde(default)]
        #[specta(optional)]
        scheme: Scheme,
    },
}

/// Declares a closed list of a custom theme: its default value is not
/// written in `world.json`.
macro_rules! theme_choice {
    ($(#[$meta:meta])* $name:ident { $(#[$first_meta:meta])* $first:ident, $($(#[$variant_meta:meta])* $variant:ident),+ $(,)? }) => {
        $(#[$meta])*
        #[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, Type)]
        #[serde(rename_all = "camelCase")]
        pub enum $name {
            $(#[$first_meta])*
            #[default]
            $first,
            $($(#[$variant_meta])* $variant),+
        }

        impl $name {
            pub fn is_default(&self) -> bool {
                *self == Self::default()
            }
        }
    };
}

theme_choice!(
    /// Material of the panels (ADR 0015): its `--bz-*` tokens, light and dark.
    Material {
        Vellum,
        Parchment,
        ColdGlass,
        Stone,
    }
);

theme_choice!(
    /// Ornament drawn on the panels (ADR 0015).
    Ornament {
        None,
        /// Thin rules along the panels.
        Rules,
        /// Corner marks.
        Marks,
        /// A colored edge.
        Edge,
    }
);

theme_choice!(
    /// Font of the headings (ADR 0015); running text stays Alegreya Sans.
    HeadingFont {
        Alegreya,
        Cinzel,
        EbGaramond,
        Playfair,
        /// The technical font of the Station theme.
        Oxanium,
    }
);

theme_choice!(
    /// Light or dark mode imposed by the world while it is open (ADR 0015).
    Scheme {
        /// Follows the app's Appearance setting.
        App,
        Light,
        Dark,
    }
);

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
            Self::Custom {
                background,
                accent,
                material,
                ornament,
                heading_font,
                scheme,
            } => {
                let hex = accent.strip_prefix('#').unwrap_or_default();
                if hex.len() != 6 || !hex.chars().all(|c| c.is_ascii_hexdigit()) {
                    return Err(AppError::InvalidInput(format!(
                        "invalid accent color: {accent:?}"
                    )));
                }
                Ok(Self::Custom {
                    background,
                    accent: accent.to_ascii_lowercase(),
                    material,
                    ornament,
                    heading_font,
                    scheme,
                })
            }
        }
    }
}

/// Writes the `theme` of `world.json` without the choices left at their
/// default value (ADR 0015), so a theme of 1.7 is written back unchanged.
/// The front receives them all (`WorldInfo`).
pub fn serialize_compact<S: Serializer>(
    theme: &WorldTheme,
    serializer: S,
) -> Result<S::Ok, S::Error> {
    /// `WorldTheme` as written in `world.json`, in the same field order.
    #[derive(Serialize)]
    #[serde(
        rename_all = "camelCase",
        rename_all_fields = "camelCase",
        tag = "kind"
    )]
    enum Compact<'a> {
        Default,
        Preset {
            id: &'a str,
        },
        Custom {
            background: Option<&'a str>,
            accent: &'a str,
            #[serde(skip_serializing_if = "Material::is_default")]
            material: Material,
            #[serde(skip_serializing_if = "Ornament::is_default")]
            ornament: Ornament,
            #[serde(skip_serializing_if = "HeadingFont::is_default")]
            heading_font: HeadingFont,
            #[serde(skip_serializing_if = "Scheme::is_default")]
            scheme: Scheme,
        },
    }
    match theme {
        WorldTheme::Default => Compact::Default,
        WorldTheme::Preset { id } => Compact::Preset { id },
        WorldTheme::Custom {
            background,
            accent,
            material,
            ornament,
            heading_font,
            scheme,
        } => Compact::Custom {
            background: background.as_deref(),
            accent,
            material: *material,
            ornament: *ornament,
            heading_font: *heading_font,
            scheme: *scheme,
        },
    }
    .serialize(serializer)
}

/// Removes a choice field whose value this app does not know (from a newer
/// app, or edited by hand), with a warning: it then reads as its default.
fn drop_unknown_choice<T: DeserializeOwned>(theme: &mut serde_json::Value, field: &str) {
    let Some(object) = theme.as_object_mut() else {
        return;
    };
    let unknown = object
        .get(field)
        .is_some_and(|value| serde_json::from_value::<T>(value.clone()).is_err());
    if unknown && let Some(value) = object.remove(field) {
        tracing::warn!(field, %value, "unknown world theme value, using the default one");
    }
}

/// Reads the `theme` of `world.json` tolerantly. An unknown material,
/// ornament, heading font or scheme gives its default value and keeps the
/// rest of the theme (ADR 0015). A theme this app cannot read otherwise
/// (unknown kind, bad accent) gives the default theme instead of refusing to
/// open the world.
pub fn deserialize_lenient<'de, D>(deserializer: D) -> Result<WorldTheme, D::Error>
where
    D: Deserializer<'de>,
{
    let mut value = serde_json::Value::deserialize(deserializer)?;
    drop_unknown_choice::<Material>(&mut value, "material");
    drop_unknown_choice::<Ornament>(&mut value, "ornament");
    drop_unknown_choice::<HeadingFont>(&mut value, "headingFont");
    drop_unknown_choice::<Scheme>(&mut value, "scheme");
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
            material: Material::Vellum,
            ornament: Ornament::None,
            heading_font: HeadingFont::Alegreya,
            scheme: Scheme::App,
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

    #[derive(Serialize)]
    struct Written {
        #[serde(
            skip_serializing_if = "WorldTheme::is_default",
            serialize_with = "serialize_compact"
        )]
        theme: WorldTheme,
    }

    /// Reads `json` as `world.json` would, then writes it back.
    fn round_trip(json: &str) -> String {
        serde_json::to_string(&Written { theme: read(json) }).unwrap()
    }

    /// Reads `json` and returns the theme with the warnings it logged.
    fn read_logged(json: &str) -> (WorldTheme, String) {
        #[derive(Clone, Default)]
        struct Logs(std::sync::Arc<std::sync::Mutex<Vec<u8>>>);
        impl std::io::Write for Logs {
            fn write(&mut self, bytes: &[u8]) -> std::io::Result<usize> {
                self.0.lock().unwrap().extend_from_slice(bytes);
                Ok(bytes.len())
            }
            fn flush(&mut self) -> std::io::Result<()> {
                Ok(())
            }
        }
        let logs = Logs::default();
        let writer = logs.clone();
        let subscriber = tracing_subscriber::fmt()
            .with_writer(move || writer.clone())
            .with_ansi(false)
            .finish();
        let theme = tracing::subscriber::with_default(subscriber, || read(json));
        let logged = String::from_utf8(logs.0.lock().unwrap().clone()).unwrap();
        (theme, logged)
    }

    #[test]
    fn themes_of_1_7_are_written_back_byte_for_byte() {
        for json in [
            r#"{}"#,
            r#"{"theme":{"kind":"preset","id":"dawn"}}"#,
            r##"{"theme":{"kind":"custom","background":null,"accent":"#5fcdc0"}}"##,
            r##"{"theme":{"kind":"custom","background":"aaaa.png","accent":"#c8912e"}}"##,
        ] {
            assert_eq!(round_trip(json), json);
        }
    }

    #[test]
    fn a_rich_theme_is_read_and_written_back() {
        let json = r##"{"theme":{"kind":"custom","background":null,"accent":"#4fd6f0","material":"coldGlass","ornament":"marks","headingFont":"oxanium","scheme":"dark"}}"##;
        assert_eq!(
            read(json),
            WorldTheme::Custom {
                background: None,
                accent: "#4fd6f0".into(),
                material: Material::ColdGlass,
                ornament: Ornament::Marks,
                heading_font: HeadingFont::Oxanium,
                scheme: Scheme::Dark,
            }
        );
        assert_eq!(round_trip(json), json);
        for font in ["alegreya", "cinzel", "ebGaramond", "playfair", "oxanium"] {
            let json = format!(
                r##"{{"theme":{{"kind":"custom","background":null,"accent":"#4fd6f0","headingFont":"{font}"}}}}"##
            );
            let expected = if font == "alegreya" {
                r##"{"theme":{"kind":"custom","background":null,"accent":"#4fd6f0"}}"##.into()
            } else {
                json.clone()
            };
            assert_eq!(round_trip(&json), expected, "{font}");
        }
    }

    #[test]
    fn default_values_are_not_written() {
        let plain = r##"{"theme":{"kind":"custom","background":null,"accent":"#5fcdc0"}}"##;
        let explicit = r##"{"theme":{"kind":"custom","background":null,"accent":"#5fcdc0","material":"vellum","ornament":"none","headingFont":"alegreya","scheme":"app"}}"##;
        assert_eq!(read(explicit), custom("#5fcdc0"));
        assert_eq!(round_trip(explicit), plain);
        assert_eq!(
            round_trip(
                r##"{"theme":{"kind":"custom","background":null,"accent":"#5fcdc0","material":"vellum"}}"##
            ),
            plain
        );
    }

    #[test]
    fn an_unknown_choice_gives_its_default_and_keeps_the_rest() {
        let rich = r##"{"kind":"custom","background":"aaaa.png","accent":"#4fd6f0","material":"stone","ornament":"edge","headingFont":"cinzel","scheme":"light"}"##;
        for (field, unknown) in [
            ("material", r#""marble""#),
            ("ornament", r#""filigree""#),
            ("headingFont", r#""comicSans""#),
            ("scheme", r#""sepia""#),
            ("material", "null"),
            ("scheme", "2"),
        ] {
            let mut theme: serde_json::Value = serde_json::from_str(rich).unwrap();
            theme[field] = serde_json::from_str(unknown).unwrap();
            let (theme, logged) = read_logged(&format!(r#"{{"theme":{theme}}}"#));

            let WorldTheme::Custom {
                background,
                accent,
                material,
                ornament,
                heading_font,
                scheme,
            } = theme
            else {
                panic!("{field}: not a custom theme");
            };
            assert_eq!(background.as_deref(), Some("aaaa.png"), "{field}");
            assert_eq!(accent, "#4fd6f0", "{field}");
            let is = |name: &str| field == name;
            assert_eq!(
                material,
                if is("material") {
                    Material::Vellum
                } else {
                    Material::Stone
                }
            );
            assert_eq!(
                ornament,
                if is("ornament") {
                    Ornament::None
                } else {
                    Ornament::Edge
                }
            );
            assert_eq!(
                heading_font,
                if is("headingFont") {
                    HeadingFont::Alegreya
                } else {
                    HeadingFont::Cinzel
                }
            );
            assert_eq!(
                scheme,
                if is("scheme") {
                    Scheme::App
                } else {
                    Scheme::Light
                }
            );
            assert!(logged.contains("WARN"), "{field}: {logged}");
            assert!(logged.contains(field), "{field}: {logged}");
        }
    }

    #[test]
    fn a_known_theme_logs_nothing() {
        let (_, logged) = read_logged(
            r##"{"theme":{"kind":"custom","background":null,"accent":"#4fd6f0","material":"parchment"}}"##,
        );
        assert_eq!(logged, "");
    }

    #[test]
    fn new_shipped_theme_ids_are_kept() {
        for id in ["grimoire", "station", "crypt"] {
            let json = format!(r#"{{"theme":{{"kind":"preset","id":"{id}"}}}}"#);
            assert_eq!(round_trip(&json), json);
        }
    }
}
