//! Tones of a world (V2-2+.4, ADR 0013): beside its main genre, which decides
//! the card types proposed, a world can be grimdark, steampunk, cozy… Kept in
//! `world.json` as a list, read tolerantly: an unknown tone is dropped, never
//! a refusal to open the world.

use serde::{Deserialize, Deserializer, Serialize};
use specta::Type;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum Tone {
    Epic,
    Grimdark,
    DarkFantasy,
    Mythology,
    Historical,
    AlternateHistory,
    Dystopian,
    PostApocalyptic,
    Steampunk,
    Solarpunk,
    Gaslamp,
    Horror,
    Mystery,
    Survival,
    Western,
    Cozy,
    Comedy,
}

/// Most tones a world can have.
pub const MAX_TONES: usize = 6;

/// The tones, without repeats, in the order given, at most `MAX_TONES`.
pub fn normalize(tones: &[Tone]) -> Vec<Tone> {
    let mut kept: Vec<Tone> = Vec::with_capacity(tones.len().min(MAX_TONES));
    for tone in tones {
        if !kept.contains(tone) && kept.len() < MAX_TONES {
            kept.push(*tone);
        }
    }
    kept
}

/// Reads `tones` tolerantly: anything but a list is no tone; unknown or
/// repeated values are dropped (with a warning).
pub fn deserialize_lenient<'de, D>(deserializer: D) -> Result<Vec<Tone>, D::Error>
where
    D: Deserializer<'de>,
{
    let value = serde_json::Value::deserialize(deserializer)?;
    let Some(items) = value.as_array() else {
        tracing::warn!(%value, "unreadable world tones, none kept");
        return Ok(Vec::new());
    };
    let tones: Vec<Tone> = items
        .iter()
        .filter_map(|item| match serde_json::from_value::<Tone>(item.clone()) {
            Ok(tone) => Some(tone),
            Err(_) => {
                tracing::warn!(value = %item, "unknown world tone, dropped");
                None
            }
        })
        .collect();
    Ok(normalize(&tones))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(Deserialize)]
    struct Probe {
        #[serde(default, deserialize_with = "deserialize_lenient")]
        tones: Vec<Tone>,
    }

    fn read(json: &str) -> Vec<Tone> {
        serde_json::from_str::<Probe>(json).unwrap().tones
    }

    #[test]
    fn tones_are_read_tolerantly() {
        assert_eq!(read("{}"), Vec::<Tone>::new());
        assert_eq!(read(r#"{ "tones": "cozy" }"#), Vec::<Tone>::new());
        assert_eq!(
            read(r#"{ "tones": ["grimdark", "unknown", "cozy", "grimdark"] }"#),
            [Tone::Grimdark, Tone::Cozy]
        );
    }

    #[test]
    fn at_most_six_tones_without_repeats() {
        let many = [
            Tone::Epic,
            Tone::Epic,
            Tone::Horror,
            Tone::Cozy,
            Tone::Western,
            Tone::Mystery,
            Tone::Comedy,
            Tone::Survival,
        ];
        assert_eq!(
            normalize(&many),
            [
                Tone::Epic,
                Tone::Horror,
                Tone::Cozy,
                Tone::Western,
                Tone::Mystery,
                Tone::Comedy
            ]
        );
    }
}
