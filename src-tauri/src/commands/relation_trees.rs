//! Relation trees (M6): trees and their variants, and the world's relation
//! types.

use sqlx::SqlitePool;
use tauri::State;

use crate::domain::trees::{self, RelationTree, RelationType, RelationTypeInput, VariantContent};
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

/// Creates a tree named `title` with one variant named `variant_name`
/// (both translated by the front) holding one empty node.
#[tauri::command]
#[specta::specta]
pub async fn create_tree(
    state: State<'_, AppState>,
    title: String,
    variant_name: String,
) -> AppResult<RelationTree> {
    trees::create(&pool(&state, "create_tree").await?, &title, &variant_name).await
}

/// A tree with its variants, in order, and their content.
#[tauri::command]
#[specta::specta]
pub async fn get_tree(state: State<'_, AppState>, id: String) -> AppResult<RelationTree> {
    trees::get(&pool(&state, "get_tree").await?, &id).await
}

/// Replaces the content of one variant (nodes, edges, annotations).
#[tauri::command]
#[specta::specta]
pub async fn save_tree_variant(
    state: State<'_, AppState>,
    variant_id: String,
    content: VariantContent,
) -> AppResult<()> {
    trees::save_variant(
        &pool(&state, "save_tree_variant").await?,
        &variant_id,
        &content,
    )
    .await
}

/// A new variant named `name`, a copy of `copy_of`, right after it.
#[tauri::command]
#[specta::specta]
pub async fn add_tree_variant(
    state: State<'_, AppState>,
    copy_of: String,
    name: String,
) -> AppResult<RelationTree> {
    trees::add_variant(&pool(&state, "add_tree_variant").await?, &copy_of, &name).await
}

#[tauri::command]
#[specta::specta]
pub async fn rename_tree_variant(
    state: State<'_, AppState>,
    id: String,
    name: String,
) -> AppResult<()> {
    trees::rename_variant(&pool(&state, "rename_tree_variant").await?, &id, &name).await
}

#[tauri::command]
#[specta::specta]
pub async fn move_tree_variant(
    state: State<'_, AppState>,
    id: String,
    index: u32,
) -> AppResult<()> {
    trees::move_variant(
        &pool(&state, "move_tree_variant").await?,
        &id,
        index as usize,
    )
    .await
}

/// Deletes a variant; the last one of a tree cannot be deleted.
#[tauri::command]
#[specta::specta]
pub async fn delete_tree_variant(state: State<'_, AppState>, id: String) -> AppResult<()> {
    trees::delete_variant(&pool(&state, "delete_tree_variant").await?, &id).await
}

/// Duplicates a tree as `title` (translated by the front), right after it.
#[tauri::command]
#[specta::specta]
pub async fn duplicate_tree(
    state: State<'_, AppState>,
    id: String,
    title: String,
) -> AppResult<RelationTree> {
    trees::duplicate(&pool(&state, "duplicate_tree").await?, &id, &title).await
}

/// The relation types of the world, provided ones first.
#[tauri::command]
#[specta::specta]
pub async fn list_relation_types(state: State<'_, AppState>) -> AppResult<Vec<RelationType>> {
    trees::relation_types(&pool(&state, "list_relation_types").await?).await
}

#[tauri::command]
#[specta::specta]
pub async fn create_relation_type(
    state: State<'_, AppState>,
    input: RelationTypeInput,
) -> AppResult<RelationType> {
    trees::create_relation_type(&pool(&state, "create_relation_type").await?, &input).await
}

#[tauri::command]
#[specta::specta]
pub async fn update_relation_type(
    state: State<'_, AppState>,
    id: String,
    input: RelationTypeInput,
) -> AppResult<RelationType> {
    trees::update_relation_type(&pool(&state, "update_relation_type").await?, &id, &input).await
}

/// How many tree links use the relation type (before deleting it).
#[tauri::command]
#[specta::specta]
pub async fn relation_type_uses(state: State<'_, AppState>, id: String) -> AppResult<u32> {
    trees::relation_type_uses(&pool(&state, "relation_type_uses").await?, &id).await
}

/// Deletes a relation type of the world; its links become « without type ».
#[tauri::command]
#[specta::specta]
pub async fn delete_relation_type(state: State<'_, AppState>, id: String) -> AppResult<()> {
    trees::delete_relation_type(&pool(&state, "delete_relation_type").await?, &id).await
}
