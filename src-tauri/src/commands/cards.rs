use sqlx::SqlitePool;
use tauri::State;

use crate::domain::cards::{self, Card};
use crate::error::{AppError, AppResult};
use crate::state::AppState;

/// Pool of the open world, taken without holding the lock.
async fn pool(state: &AppState, command: &str) -> AppResult<SqlitePool> {
    state
        .world
        .lock()
        .await
        .as_ref()
        .map(|world| world.pool.clone())
        .ok_or_else(|| AppError::NoWorldOpen(command.into()))
}

/// Creates a card of a type (or subtype). Rename it with `rename_document`,
/// put it in the trash with `trash_document`.
#[tauri::command]
#[specta::specta]
pub async fn create_card(
    state: State<'_, AppState>,
    type_id: String,
    title: String,
) -> AppResult<Card> {
    cards::create(&pool(&state, "create_card").await?, &type_id, &title).await
}

/// Cards of the open world (or of its trash), by title.
#[tauri::command]
#[specta::specta]
pub async fn list_cards(state: State<'_, AppState>, trashed: bool) -> AppResult<Vec<Card>> {
    cards::list(&pool(&state, "list_cards").await?, trashed).await
}

#[tauri::command]
#[specta::specta]
pub async fn get_card(state: State<'_, AppState>, id: String) -> AppResult<Card> {
    cards::get(&pool(&state, "get_card").await?, &id).await
}

#[tauri::command]
#[specta::specta]
pub async fn set_card_type(
    state: State<'_, AppState>,
    id: String,
    type_id: String,
) -> AppResult<Card> {
    cards::set_type(&pool(&state, "set_card_type").await?, &id, &type_id).await
}

/// Sets (asset id) or removes (`null`) the card's image.
#[tauri::command]
#[specta::specta]
pub async fn set_card_image(
    state: State<'_, AppState>,
    id: String,
    asset_id: Option<String>,
) -> AppResult<Card> {
    cards::set_image(
        &pool(&state, "set_card_image").await?,
        &id,
        asset_id.as_deref(),
    )
    .await
}

/// Replaces the card's aliases (trimmed, without duplicates).
#[tauri::command]
#[specta::specta]
pub async fn set_card_aliases(
    state: State<'_, AppState>,
    id: String,
    aliases: Vec<String>,
) -> AppResult<Card> {
    cards::set_aliases(&pool(&state, "set_card_aliases").await?, &id, &aliases).await
}

/// Number of cards of a type and its subtypes.
#[tauri::command]
#[specta::specta]
pub async fn count_type_cards(state: State<'_, AppState>, type_id: String) -> AppResult<u32> {
    cards::count_of_type(&pool(&state, "count_type_cards").await?, &type_id).await
}
