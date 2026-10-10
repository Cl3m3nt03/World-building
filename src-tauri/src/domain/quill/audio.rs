//! The sounds of a draft (M10, ADR 0010): an effect played when the reading
//! reaches its passage, or an ambience heard all along it. The passage
//! carries an `audioCue` mark with the sound's id, as a note does.

use serde::{Deserialize, Serialize};
use specta::Type;
use sqlx::SqlitePool;
use uuid::Uuid;

use super::{check_asset, draft_row, invalid};
use crate::db;
use crate::db::quill::{self as queries, CueRow};
use crate::domain::documents::now;
use crate::error::AppResult;

/// The mark that anchors a sound to its passage, in a draft's content.
pub const CUE_MARK: &str = "audioCue";

/// The attribute of [`CUE_MARK`] that holds the sound's id.
pub const CUE_ATTR: &str = "cueId";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum CueKind {
    /// Played once when the reading reaches the passage.
    Effect,
    /// Heard from the passage's first paragraph to its last.
    Ambience,
}

impl CueKind {
    fn as_str(self) -> &'static str {
        match self {
            Self::Effect => "effect",
            Self::Ambience => "ambience",
        }
    }

    fn parse(value: &str) -> Self {
        if value == "ambience" {
            Self::Ambience
        } else {
            Self::Effect
        }
    }
}

/// A sound on a passage of a draft.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AudioCue {
    pub id: String,
    pub draft_id: String,
    pub kind: CueKind,
    /// An audio asset; None once its file was deleted.
    pub asset_id: Option<String>,
    /// 0 to 100.
    pub volume: u8,
    /// An ambience starts again when it ends.
    pub looped: bool,
    pub created_at: String,
    pub updated_at: String,
}

/// What changes on a sound; None keeps the current value.
#[derive(Debug, Clone, Default, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CuePatch {
    pub asset_id: Option<String>,
    pub volume: Option<u8>,
    pub looped: Option<bool>,
}

pub(super) fn cue_of(row: CueRow) -> AudioCue {
    AudioCue {
        id: row.id,
        draft_id: row.draft_id,
        kind: CueKind::parse(&row.kind),
        asset_id: row.asset_id,
        volume: u8::try_from(row.volume.clamp(0, 100)).unwrap_or(100),
        looped: row.looped,
        created_at: row.created_at,
        updated_at: row.updated_at,
    }
}

/// The asset must be an audio file of the media library.
async fn check_sound(pool: &SqlitePool, asset_id: &str) -> AppResult<()> {
    check_asset(Some(asset_id))?;
    match db::assets::get(pool, asset_id).await? {
        Some(asset) if asset.kind == "audio" => Ok(()),
        Some(_) => Err(invalid(format!("not an audio file: {asset_id}"))),
        None => Err(invalid(format!("asset not found: {asset_id}"))),
    }
}

fn check_volume(volume: u8) -> AppResult<()> {
    if volume > 100 {
        return Err(invalid("a volume is 0 to 100"));
    }
    Ok(())
}

/// Adds a sound to a draft (its mark is put on the passage by the front). An
/// ambience loops by default, an effect does not.
pub async fn create_cue(
    pool: &SqlitePool,
    draft_id: &str,
    kind: CueKind,
    asset_id: &str,
) -> AppResult<AudioCue> {
    check_sound(pool, asset_id).await?;
    let mut tx = db::begin_write(pool).await?;
    draft_row(&mut tx, draft_id).await?;
    let now = now();
    let row = CueRow {
        id: Uuid::new_v4().to_string(),
        draft_id: draft_id.to_owned(),
        kind: kind.as_str().to_owned(),
        asset_id: Some(asset_id.to_owned()),
        volume: 80,
        looped: kind == CueKind::Ambience,
        created_at: now.clone(),
        updated_at: now,
    };
    queries::insert_cue(&mut *tx, &row).await?;
    tx.commit().await?;
    Ok(cue_of(row))
}

pub async fn update_cue(pool: &SqlitePool, id: &str, patch: &CuePatch) -> AppResult<AudioCue> {
    if let Some(asset_id) = &patch.asset_id {
        check_sound(pool, asset_id).await?;
    }
    if let Some(volume) = patch.volume {
        check_volume(volume)?;
    }
    let mut row = queries::cue(pool, id)
        .await?
        .ok_or_else(|| invalid(format!("sound not found: {id}")))?;
    if let Some(asset_id) = &patch.asset_id {
        row.asset_id = Some(asset_id.clone());
    }
    if let Some(volume) = patch.volume {
        row.volume = i64::from(volume);
    }
    if let Some(looped) = patch.looped {
        row.looped = looped;
    }
    row.updated_at = now();
    if !queries::update_cue(pool, &row).await? {
        return Err(invalid(format!("sound not found: {id}")));
    }
    Ok(cue_of(row))
}

pub async fn delete_cue(pool: &SqlitePool, id: &str) -> AppResult<()> {
    if !queries::delete_cue(pool, id).await? {
        return Err(invalid(format!("sound not found: {id}")));
    }
    Ok(())
}

/// The sounds of a draft, oldest first (the front orders them by the text).
pub async fn draft_cues(pool: &SqlitePool, draft_id: &str) -> AppResult<Vec<AudioCue>> {
    Ok(queries::draft_cues(pool, draft_id)
        .await?
        .into_iter()
        .map(cue_of)
        .collect())
}
