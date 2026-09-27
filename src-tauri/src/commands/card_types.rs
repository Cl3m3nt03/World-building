use sqlx::SqlitePool;
use tauri::State;

use crate::domain::card_types::{self, CardType, CardTypePatch, NewCardType};
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

/// Card types of the open world: each type followed by its subtypes, in order.
#[tauri::command]
#[specta::specta]
pub async fn list_card_types(state: State<'_, AppState>) -> AppResult<Vec<CardType>> {
    card_types::list(&pool(&state, "list_card_types").await?).await
}

/// Creates a type, or a subtype when `parentId` is set.
#[tauri::command]
#[specta::specta]
pub async fn create_card_type(
    state: State<'_, AppState>,
    card_type: NewCardType,
) -> AppResult<CardType> {
    card_types::create(&pool(&state, "create_card_type").await?, card_type).await
}

#[tauri::command]
#[specta::specta]
pub async fn update_card_type(
    state: State<'_, AppState>,
    id: String,
    patch: CardTypePatch,
) -> AppResult<CardType> {
    card_types::update(&pool(&state, "update_card_type").await?, &id, patch).await
}

/// Copies a type and its subtypes under a new name.
#[tauri::command]
#[specta::specta]
pub async fn duplicate_card_type(
    state: State<'_, AppState>,
    id: String,
    name: String,
) -> AppResult<CardType> {
    card_types::duplicate(&pool(&state, "duplicate_card_type").await?, &id, &name).await
}

/// Orders the types (or the subtypes of one type) as `ids`.
#[tauri::command]
#[specta::specta]
pub async fn reorder_card_types(state: State<'_, AppState>, ids: Vec<String>) -> AppResult<()> {
    card_types::reorder(&pool(&state, "reorder_card_types").await?, &ids).await
}

/// Deletes a type and its subtypes; their cards move to `moveCardsTo`.
#[tauri::command]
#[specta::specta]
pub async fn delete_card_type(
    state: State<'_, AppState>,
    id: String,
    move_cards_to: Option<String>,
) -> AppResult<()> {
    card_types::delete(
        &pool(&state, "delete_card_type").await?,
        &id,
        move_cards_to.as_deref(),
    )
    .await
}
