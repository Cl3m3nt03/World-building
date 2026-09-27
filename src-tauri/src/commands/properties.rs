use sqlx::SqlitePool;
use tauri::State;

use crate::domain::properties::{
    self, CardProperty, PropertyDefinition, PropertyKind, PropertyOwner, PropertyValue,
};
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

/// Properties defined on a card type (not the inherited ones).
#[tauri::command]
#[specta::specta]
pub async fn list_type_properties(
    state: State<'_, AppState>,
    type_id: String,
) -> AppResult<Vec<PropertyDefinition>> {
    properties::of_type(&pool(&state, "list_type_properties").await?, &type_id).await
}

/// The properties a card shows (its type's, then its own) with its values.
#[tauri::command]
#[specta::specta]
pub async fn card_properties(
    state: State<'_, AppState>,
    card_id: String,
) -> AppResult<Vec<CardProperty>> {
    properties::of_card(&pool(&state, "card_properties").await?, &card_id).await
}

/// Adds a property to a type or a card.
#[tauri::command]
#[specta::specta]
pub async fn create_property(
    state: State<'_, AppState>,
    owner: PropertyOwner,
    label: String,
    kind: PropertyKind,
) -> AppResult<PropertyDefinition> {
    properties::create(&pool(&state, "create_property").await?, owner, &label, kind).await
}

#[tauri::command]
#[specta::specta]
pub async fn rename_property(
    state: State<'_, AppState>,
    id: String,
    label: String,
) -> AppResult<PropertyDefinition> {
    properties::rename(&pool(&state, "rename_property").await?, &id, &label).await
}

/// Changes a property's kind; values of the old kind are dropped.
#[tauri::command]
#[specta::specta]
pub async fn set_property_kind(
    state: State<'_, AppState>,
    id: String,
    kind: PropertyKind,
    target_type_ids: Vec<String>,
) -> AppResult<PropertyDefinition> {
    properties::set_kind(
        &pool(&state, "set_property_kind").await?,
        &id,
        kind,
        &target_type_ids,
    )
    .await
}

/// Shows a type property on the cards created before it too.
#[tauri::command]
#[specta::specta]
pub async fn apply_property_to_existing(
    state: State<'_, AppState>,
    id: String,
) -> AppResult<PropertyDefinition> {
    properties::apply_to_existing(&pool(&state, "apply_property_to_existing").await?, &id).await
}

#[tauri::command]
#[specta::specta]
pub async fn reorder_properties(state: State<'_, AppState>, ids: Vec<String>) -> AppResult<()> {
    properties::reorder(&pool(&state, "reorder_properties").await?, &ids).await
}

/// Number of values deleting the property would lose.
#[tauri::command]
#[specta::specta]
pub async fn count_property_values(state: State<'_, AppState>, id: String) -> AppResult<u32> {
    properties::count_values(&pool(&state, "count_property_values").await?, &id).await
}

#[tauri::command]
#[specta::specta]
pub async fn delete_property(state: State<'_, AppState>, id: String) -> AppResult<()> {
    properties::delete(&pool(&state, "delete_property").await?, &id).await
}

/// Sets or clears (`null`) a card's value; returns the card's properties.
#[tauri::command]
#[specta::specta]
pub async fn set_property_value(
    state: State<'_, AppState>,
    card_id: String,
    property_id: String,
    value: Option<PropertyValue>,
) -> AppResult<Vec<CardProperty>> {
    properties::set_value(
        &pool(&state, "set_property_value").await?,
        &card_id,
        &property_id,
        value,
    )
    .await
}
