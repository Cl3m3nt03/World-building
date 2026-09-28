//! Writing preferences of a world (ADR 0004), saved in `world.json`. All are
//! on by default, as in vvd.

use serde::{Deserialize, Deserializer, Serialize};
use specta::Type;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct WorldPreferences {
    /// Card names and aliases written in text blocks are underlined, and
    /// can be turned into mentions.
    pub entity_detection: bool,
    /// A card name or alias typed in a text block becomes a mention as soon
    /// as the next character is typed.
    pub auto_mention_links: bool,
    /// A mention created automatically shows with a short animation.
    pub animate_new_links: bool,
}

impl Default for WorldPreferences {
    fn default() -> Self {
        Self {
            entity_detection: true,
            auto_mention_links: true,
            animate_new_links: true,
        }
    }
}

impl WorldPreferences {
    pub fn is_default(&self) -> bool {
        *self == Self::default()
    }
}

/// Reads the `preferences` of `world.json` tolerantly, field by field: a
/// missing field or one that is not a boolean keeps its default value, and
/// unknown fields are ignored. Never refuses to open the world.
pub fn deserialize_lenient<'de, D>(deserializer: D) -> Result<WorldPreferences, D::Error>
where
    D: Deserializer<'de>,
{
    let value = serde_json::Value::deserialize(deserializer)?;
    let defaults = WorldPreferences::default();
    let Some(object) = value.as_object() else {
        tracing::warn!(%value, "unreadable world preferences, using the defaults");
        return Ok(defaults);
    };
    let read = |key: &str, default: bool| match object.get(key) {
        None => default,
        Some(serde_json::Value::Bool(value)) => *value,
        Some(other) => {
            tracing::warn!(key, value = %other, "unreadable world preference, using the default");
            default
        }
    };
    Ok(WorldPreferences {
        entity_detection: read("entityDetection", defaults.entity_detection),
        auto_mention_links: read("autoMentionLinks", defaults.auto_mention_links),
        animate_new_links: read("animateNewLinks", defaults.animate_new_links),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(Deserialize)]
    struct Holder {
        #[serde(default, deserialize_with = "deserialize_lenient")]
        preferences: WorldPreferences,
    }

    fn read(json: &str) -> WorldPreferences {
        serde_json::from_str::<Holder>(json).unwrap().preferences
    }

    #[test]
    fn everything_is_on_by_default() {
        assert_eq!(read("{}"), WorldPreferences::default());
        assert!(WorldPreferences::default().auto_mention_links);
    }

    #[test]
    fn reading_is_tolerant_field_by_field() {
        let off = read(r#"{"preferences":{"autoMentionLinks":false}}"#);
        assert!(!off.auto_mention_links);
        assert!(off.entity_detection && off.animate_new_links);

        // A bad value keeps its default, the others are read.
        let mixed =
            read(r#"{"preferences":{"entityDetection":"no","animateNewLinks":false,"x":1}}"#);
        assert!(mixed.entity_detection);
        assert!(!mixed.animate_new_links);

        for json in [r#"{"preferences":null}"#, r#"{"preferences":[false]}"#] {
            assert_eq!(read(json), WorldPreferences::default(), "{json}");
        }
    }
}
