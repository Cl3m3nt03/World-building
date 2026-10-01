//! Interface state of a world (ADR 0005), saved in `world.db`: for now, the
//! sidebar's. Read tolerantly: a missing or unreadable state is the default
//! one, never an error.

use serde::{Deserialize, Serialize};
use specta::Type;
use sqlx::SqlitePool;

use crate::db::ui_state as queries;
use crate::domain::documents::DocumentKind;
use crate::error::AppResult;

#[cfg(test)]
mod tests;

const SIDEBAR_KEY: &str = "sidebar";
/// Bounds of the sidebar width, in pixels (as the front's `SIDEBAR_WIDTH`).
pub const SIDEBAR_MIN_WIDTH: u32 = 200;
pub const SIDEBAR_MAX_WIDTH: u32 = 480;
/// Most open folders and parents remembered; most card types in a filter.
const MAX_EXPANDED: usize = 10_000;
const MAX_TYPE_FILTERS: usize = 500;

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum SortBy {
    #[default]
    Manual,
    Name,
    Created,
}

/// Filters and sort of the sidebar (step 3.8).
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct SidebarView {
    pub kinds: Vec<DocumentKind>,
    pub type_ids: Vec<String>,
    pub sort: SortBy,
    pub reversed: bool,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct SidebarState {
    /// In pixels; `None`: the default width.
    pub width: Option<u32>,
    pub collapsed: bool,
    /// Keys of the open folders and parents (`f:<id>`, `d:<id>`).
    pub expanded: Vec<String>,
    pub view: SidebarView,
}

/// The sidebar's state as saved, or the default one.
pub async fn sidebar(pool: &SqlitePool) -> AppResult<SidebarState> {
    let Some(json) = queries::get(pool, SIDEBAR_KEY).await? else {
        return Ok(SidebarState::default());
    };
    Ok(serde_json::from_str(&json).unwrap_or_else(|error| {
        tracing::warn!(%error, "unreadable sidebar state, using the default one");
        SidebarState::default()
    }))
}

/// Saves the sidebar's state, bounded (width, list lengths).
pub async fn set_sidebar(pool: &SqlitePool, state: SidebarState) -> AppResult<SidebarState> {
    let mut state = state;
    state.width = state
        .width
        .map(|width| width.clamp(SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH));
    state.expanded.dedup();
    state.expanded.truncate(MAX_EXPANDED);
    state.view.type_ids.truncate(MAX_TYPE_FILTERS);
    state.view.kinds.dedup();
    let json = serde_json::to_string(&state)
        .map_err(|error| crate::error::AppError::Internal(error.to_string()))?;
    queries::set(pool, SIDEBAR_KEY, &json).await?;
    Ok(state)
}
