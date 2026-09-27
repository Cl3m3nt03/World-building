use tauri::State;

use crate::domain::links::{self, Backlink};
use crate::error::{AppError, AppResult};
use crate::state::AppState;

/// Documents citing a card ("cited in"), with how they cite it.
#[tauri::command]
#[specta::specta]
pub async fn card_backlinks(
    state: State<'_, AppState>,
    card_id: String,
) -> AppResult<Vec<Backlink>> {
    let pool = state
        .world
        .lock()
        .await
        .as_ref()
        .map(|world| world.pool.clone())
        .ok_or_else(|| AppError::NoWorldOpen("card_backlinks".into()))?;
    links::backlinks(&pool, &card_id).await
}
