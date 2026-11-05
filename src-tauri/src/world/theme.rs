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

/// Keys of the `theme` of `world.json` this app reads, by kind.
fn known_keys(kind: &str) -> &'static [&'static str] {
    match kind {
        "preset" => &["kind", "id"],
        "custom" => &[
            "kind",
            "background",
            "accent",
            "material",
            "ornament",
            "headingFont",
            "scheme",
        ],
        _ => &["kind"],
    }
}

/// The four choices of a custom theme, as written in `world.json`.
const CHOICES: [&str; 4] = ["material", "ornament", "headingFont", "scheme"];

fn is_known_choice(field: &str, value: &serde_json::Value) -> bool {
    fn parses<T: DeserializeOwned>(value: &serde_json::Value) -> bool {
        serde_json::from_value::<T>(value.clone()).is_ok()
    }
    match field {
        "material" => parses::<Material>(value),
        "ornament" => parses::<Ornament>(value),
        "headingFont" => parses::<HeadingFont>(value),
        _ => parses::<Scheme>(value),
    }
}

/// Whether `theme` sets the choice `field` to something else than its default.
fn choice_is_set(theme: &WorldTheme, field: &str) -> bool {
    let WorldTheme::Custom {
        material,
        ornament,
        heading_font,
        scheme,
        ..
    } = theme
    else {
        return false;
    };
    match field {
        "material" => !material.is_default(),
        "ornament" => !ornament.is_default(),
        "headingFont" => !heading_font.is_default(),
        _ => !scheme.is_default(),
    }
}

/// The `theme` of `world.json`: what this app understands, and what it keeps
/// without understanding it (written by a newer app, or by hand), so that
/// saving the world never loses it.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct StoredTheme {
    /// The theme as this app reads it.
    pub theme: WorldTheme,
    /// Keys this app does not know, and choices with a value it does not
    /// know (read as their default). Kept while the kind stays the same.
    unknown: serde_json::Map<String, serde_json::Value>,
    /// A theme this app cannot read at all (unknown kind, bad accent): shown
    /// as the default theme, kept until another theme is set.
    unreadable: Option<serde_json::Value>,
}

impl From<WorldTheme> for StoredTheme {
    fn from(theme: WorldTheme) -> Self {
        Self {
            theme,
            ..Self::default()
        }
    }
}

impl StoredTheme {
    pub fn is_default(&self) -> bool {
        self.theme.is_default() && self.unknown.is_empty() && self.unreadable.is_none()
    }

    pub fn background(&self) -> Option<&str> {
        self.theme.background()
    }

    /// Sets `theme`. The unknown keys are kept while the kind stays the same,
    /// and an unknown choice value while `theme` leaves that choice at its
    /// default (this app could not have shown it otherwise).
    pub fn set(&mut self, theme: WorldTheme) {
        let same_kind = std::mem::discriminant(&theme) == std::mem::discriminant(&self.theme);
        if same_kind && self.unreadable.is_none() {
            self.unknown.retain(|field, _| {
                !CHOICES.contains(&field.as_str()) || !choice_is_set(&theme, field)
            });
        } else {
            self.unknown.clear();
        }
        self.unreadable = None;
        self.theme = theme;
    }

    /// Reads a `theme` value tolerantly (ADR 0015). An unknown material,
    /// ornament, heading font or scheme reads as its default, with a warning,
    /// and the rest of the theme is kept. A theme this app cannot read
    /// otherwise reads as the default theme instead of refusing to open the
    /// world. Neither is dropped: both are written back as they were.
    fn read(value: serde_json::Value) -> Self {
        let serde_json::Value::Object(mut object) = value.clone() else {
            return Self::unreadable(value, "not an object".into());
        };
        let kind = object
            .get("kind")
            .and_then(|kind| kind.as_str())
            .unwrap_or_default();
        let known = known_keys(kind);
        let mut unknown = serde_json::Map::new();
        let fields: Vec<String> = object.keys().cloned().collect();
        for field in fields {
            let choice = CHOICES.contains(&field.as_str());
            let keep = known.contains(&field.as_str())
                && (!choice || is_known_choice(&field, &object[&field]));
            if !keep && let Some(value) = object.remove(&field) {
                if choice {
                    tracing::warn!(field, %value, "unknown world theme value, using the default one");
                }
                unknown.insert(field, value);
            }
        }
        match serde_json::from_value::<WorldTheme>(serde_json::Value::Object(object))
            .map_err(|error| error.to_string())
            .and_then(|theme| theme.validated().map_err(|error| error.to_string()))
        {
            Ok(theme) => Self {
                theme,
                unknown,
                unreadable: None,
            },
            Err(error) => Self::unreadable(value, error),
        }
    }

    fn unreadable(value: serde_json::Value, error: String) -> Self {
        tracing::warn!(%error, %value, "unreadable world theme, using the default one");
        Self {
            unreadable: Some(value),
            ..Self::default()
        }
    }
}

impl<'de> Deserialize<'de> for StoredTheme {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        Ok(Self::read(serde_json::Value::deserialize(deserializer)?))
    }
}

/// Writes the theme without the choices left at their default value, so a
/// theme of 1.7 is written back unchanged, then the keys kept unread. The
/// front receives every choice (`WorldInfo`).
impl Serialize for StoredTheme {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        type Unknown<'a> = &'a serde_json::Map<String, serde_json::Value>;
        /// `WorldTheme` as written in `world.json`, in the same field order.
        #[derive(Serialize)]
        #[serde(
            rename_all = "camelCase",
            rename_all_fields = "camelCase",
            tag = "kind"
        )]
        enum Compact<'a> {
            Default {
                #[serde(flatten)]
                unknown: Unknown<'a>,
            },
            Preset {
                id: &'a str,
                #[serde(flatten)]
                unknown: Unknown<'a>,
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
                #[serde(flatten)]
                unknown: Unknown<'a>,
            },
        }
        if let Some(value) = &self.unreadable {
            return value.serialize(serializer);
        }
        let unknown = &self.unknown;
        match &self.theme {
            WorldTheme::Default => Compact::Default { unknown },
            WorldTheme::Preset { id } => Compact::Preset { id, unknown },
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
                unknown,
            },
        }
        .serialize(serializer)
    }
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

    /// The `theme` of `world.json`, as `WorldFile` reads and writes it.
    #[derive(Deserialize, Serialize)]
    struct Holder {
        #[serde(default, skip_serializing_if = "StoredTheme::is_default")]
        theme: StoredTheme,
    }

    fn stored(json: &str) -> StoredTheme {
        serde_json::from_str::<Holder>(json).unwrap().theme
    }

    fn read(json: &str) -> WorldTheme {
        stored(json).theme
    }

    fn write(theme: StoredTheme) -> String {
        serde_json::to_string(&Holder { theme }).unwrap()
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

    /// Reads `json` as `world.json` would, then writes it back.
    fn round_trip(json: &str) -> String {
        write(stored(json))
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

    fn value(json: &str) -> serde_json::Value {
        serde_json::from_str(json).unwrap()
    }

    #[test]
    fn what_this_app_does_not_know_is_written_back() {
        for json in [
            // Unknown choice values (read as their default).
            r##"{"theme":{"kind":"custom","background":null,"accent":"#4fd6f0","material":"marble","scheme":"sepia"}}"##,
            // Unknown keys, in each kind.
            r##"{"theme":{"kind":"custom","background":null,"accent":"#4fd6f0","grain":0.4,"ornament":"edge"}}"##,
            r#"{"theme":{"kind":"preset","id":"grimoire","variant":2}}"#,
            r#"{"theme":{"kind":"default","since":"1.9"}}"#,
            // Unreadable themes (read as the default theme).
            r#"{"theme":{"kind":"animated","speed":2}}"#,
            r##"{"theme":{"kind":"custom","background":null,"accent":"blue"}}"##,
            r#"{"theme":"dawn"}"#,
        ] {
            assert_eq!(value(&round_trip(json)), value(json), "{json}");
        }
        assert_eq!(
            read(
                r##"{"theme":{"kind":"custom","background":null,"accent":"#4fd6f0","grain":0.4,"ornament":"edge"}}"##
            ),
            WorldTheme::Custom {
                background: None,
                accent: "#4fd6f0".into(),
                material: Material::Vellum,
                ornament: Ornament::Edge,
                heading_font: HeadingFont::Alegreya,
                scheme: Scheme::App,
            }
        );
    }

    #[test]
    fn setting_a_theme_keeps_what_it_does_not_replace() {
        let json = r##"{"theme":{"kind":"custom","background":null,"accent":"#4fd6f0","material":"marble","scheme":"sepia","grain":0.4}}"##;

        // Same kind, the accent changed: everything unknown stays.
        let mut theme = stored(json);
        theme.set(custom("#b39af5"));
        assert_eq!(
            value(&write(theme.clone())),
            value(
                r##"{"theme":{"kind":"custom","background":null,"accent":"#b39af5","material":"marble","scheme":"sepia","grain":0.4}}"##
            )
        );

        // A material chosen here replaces the unknown one; the rest stays.
        let mut chosen = custom("#b39af5");
        if let WorldTheme::Custom { material, .. } = &mut chosen {
            *material = Material::Stone;
        }
        theme.set(chosen);
        assert_eq!(
            value(&write(theme.clone())),
            value(
                r##"{"theme":{"kind":"custom","background":null,"accent":"#b39af5","material":"stone","scheme":"sepia","grain":0.4}}"##
            )
        );

        // Another kind: what belonged to the custom theme goes.
        theme.set(WorldTheme::Preset { id: "dawn".into() });
        assert_eq!(write(theme), r#"{"theme":{"kind":"preset","id":"dawn"}}"#);

        // An unreadable theme is replaced by the one set.
        let mut theme = stored(r#"{"theme":{"kind":"animated","speed":2}}"#);
        theme.set(WorldTheme::Default);
        assert_eq!(write(theme), "{}");
    }
}
