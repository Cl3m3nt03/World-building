//! The world's calendar (ADR 0011), saved in `world.json`: its eras and its
//! months. The timelines count days from the year 0; the calendar only says
//! how to name them. Read tolerantly: an unreadable calendar is the default.

use serde::{Deserialize, Deserializer, Serialize};
use specta::Type;

use crate::error::{AppError, AppResult};

/// Most eras and months a calendar holds.
pub const MAX_ERAS: usize = 20;
pub const MAX_MONTHS: usize = 24;
/// Longest month, in days.
pub const MAX_MONTH_DAYS: u16 = 400;
/// Longest name, in characters.
pub const MAX_NAME: usize = 60;

/// A named stretch of years, from `start_year` to the next era's start.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Era {
    pub name: String,
    /// Shown after a year: « 298 DC ».
    pub abbreviation: String,
    /// The first year of the era (counted from the calendar's year 0).
    pub start_year: i32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Month {
    /// Empty: « Mois 3 » (translated by the front).
    pub name: String,
    pub days: u16,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct WorldCalendar {
    /// In order of their start; none: years are shown as they are.
    pub eras: Vec<Era>,
    /// At least one.
    pub months: Vec<Month>,
}

impl Default for WorldCalendar {
    fn default() -> Self {
        Self {
            eras: Vec::new(),
            months: (0..12)
                .map(|_| Month {
                    name: String::new(),
                    days: 30,
                })
                .collect(),
        }
    }
}

impl WorldCalendar {
    pub fn is_default(&self) -> bool {
        *self == Self::default()
    }

    /// Checks the calendar and puts its eras in the order of their start.
    pub fn checked(mut self) -> AppResult<Self> {
        let invalid = |message: String| Err(AppError::InvalidInput(message));
        if self.months.is_empty() || self.months.len() > MAX_MONTHS {
            return invalid(format!("a calendar has 1 to {MAX_MONTHS} months"));
        }
        if self.eras.len() > MAX_ERAS {
            return invalid(format!("a calendar has at most {MAX_ERAS} eras"));
        }
        for month in &self.months {
            if month.days == 0 || month.days > MAX_MONTH_DAYS {
                return invalid(format!("a month has 1 to {MAX_MONTH_DAYS} days"));
            }
            if month.name.chars().count() > MAX_NAME {
                return invalid(format!("a month's name has at most {MAX_NAME} characters"));
            }
        }
        for era in &self.eras {
            if era.name.chars().count() > MAX_NAME || era.abbreviation.chars().count() > MAX_NAME {
                return invalid(format!("an era's names have at most {MAX_NAME} characters"));
            }
        }
        self.eras.sort_by_key(|era| era.start_year);
        if self
            .eras
            .windows(2)
            .any(|pair| pair[0].start_year == pair[1].start_year)
        {
            return invalid("two eras cannot start the same year".to_owned());
        }
        Ok(self)
    }
}

/// Reads the `calendar` of `world.json` tolerantly: a calendar that is not
/// valid is the default one (logged), the world still opens.
pub fn deserialize_lenient<'de, D>(deserializer: D) -> Result<WorldCalendar, D::Error>
where
    D: Deserializer<'de>,
{
    let value = serde_json::Value::deserialize(deserializer)?;
    match serde_json::from_value::<WorldCalendar>(value.clone())
        .map_err(|error| error.to_string())
        .and_then(|calendar| calendar.checked().map_err(|error| error.to_string()))
    {
        Ok(calendar) => Ok(calendar),
        Err(error) => {
            tracing::warn!(%value, %error, "unreadable world calendar, using the default");
            Ok(WorldCalendar::default())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(Deserialize)]
    struct Holder {
        #[serde(default, deserialize_with = "deserialize_lenient")]
        calendar: WorldCalendar,
    }

    fn read(json: &str) -> WorldCalendar {
        serde_json::from_str::<Holder>(json).unwrap().calendar
    }

    #[test]
    fn twelve_months_of_thirty_days_by_default() {
        let calendar = read("{}");
        assert_eq!(calendar, WorldCalendar::default());
        assert_eq!(calendar.months.len(), 12);
        assert!(calendar.months.iter().all(|month| month.days == 30));
    }

    #[test]
    fn a_calendar_is_read_with_its_eras_in_order() {
        let calendar = read(
            r#"{ "calendar": { "eras": [
                { "name": "Après la Conquête", "abbreviation": "DC", "startYear": 0 },
                { "name": "Avant la Conquête", "abbreviation": "AC", "startYear": -10000 }
            ], "months": [{ "name": "Lune 1", "days": 28 }] } }"#,
        );
        assert_eq!(calendar.eras[0].abbreviation, "AC");
        assert_eq!(calendar.months[0].days, 28);
    }

    #[test]
    fn a_bad_calendar_is_the_default_one() {
        assert_eq!(
            read(r#"{ "calendar": { "eras": [], "months": [] } }"#),
            WorldCalendar::default()
        );
        assert_eq!(read(r#"{ "calendar": 3 }"#), WorldCalendar::default());
        let zero_days = r#"{ "calendar": { "eras": [], "months": [{ "name": "", "days": 0 }] } }"#;
        assert_eq!(read(zero_days), WorldCalendar::default());
    }

    #[test]
    fn two_eras_cannot_start_together() {
        let calendar = WorldCalendar {
            eras: vec![
                Era {
                    name: "A".into(),
                    abbreviation: "A".into(),
                    start_year: 0,
                },
                Era {
                    name: "B".into(),
                    abbreviation: "B".into(),
                    start_year: 0,
                },
            ],
            ..WorldCalendar::default()
        };
        assert!(calendar.checked().is_err());
    }
}
