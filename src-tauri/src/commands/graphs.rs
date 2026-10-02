//! Graphs (M5): create, read, save the configuration, duplicate, and the
//! cards and links a graph draws.

use sqlx::SqlitePool;
use tauri::State;

use crate::domain::graphs::{self, Graph, GraphConfig, GraphData};
use crate::error::{AppError, AppResult};
use crate::state::AppState;

async fn pool(state: &AppState, command: &str) -> AppResult<SqlitePool> {
    state
        .world
        .lock()
        .await
        .as_ref()
        .map(|world| world.pool.clone())
        .ok_or_else(|| AppError::NoWorldOpen(command.into()))
}

/// Creates a graph named `title` (translated by the front), showing every card.
#[tauri::command]
#[specta::specta]
pub async fn create_graph(state: State<'_, AppState>, title: String) -> AppResult<Graph> {
    graphs::create(&pool(&state, "create_graph").await?, &title).await
}

#[tauri::command]
#[specta::specta]
pub async fn get_graph(state: State<'_, AppState>, id: String) -> AppResult<Graph> {
    graphs::get(&pool(&state, "get_graph").await?, &id).await
}

/// Replaces the graph's configuration: filters, settings, pinned nodes, framing.
#[tauri::command]
#[specta::specta]
pub async fn save_graph(
    state: State<'_, AppState>,
    id: String,
    config: GraphConfig,
) -> AppResult<()> {
    graphs::save(&pool(&state, "save_graph").await?, &id, &config).await
}

/// Duplicates a graph as `title` (translated by the front), right after it.
#[tauri::command]
#[specta::specta]
pub async fn duplicate_graph(
    state: State<'_, AppState>,
    id: String,
    title: String,
) -> AppResult<Graph> {
    graphs::duplicate(&pool(&state, "duplicate_graph").await?, &id, &title).await
}

/// The live cards and their links (mentions, link properties), one edge per
/// pair of cards.
#[tauri::command]
#[specta::specta]
pub async fn graph_data(state: State<'_, AppState>) -> AppResult<GraphData> {
    graphs::data(&pool(&state, "graph_data").await?).await
}
