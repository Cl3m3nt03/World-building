//! Queries on the sidebar tree: folders, and where documents are
//! (`folder_id`, `parent_id`, `sort_order`, migration `0007`).
//!
//! `x IS ?` compares with NULL too: a `None` place means the root.

use sqlx::{Sqlite, SqlitePool, Transaction};

use crate::error::AppResult;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FolderRow {
    pub id: String,
    pub parent_id: Option<String>,
    pub name: String,
    pub icon: String,
    pub sort_order: i64,
    pub created_at: String,
}

/// A live document as the sidebar shows it, with the card's type and image.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TreeDocumentRow {
    pub id: String,
    pub kind: String,
    pub title: String,
    pub folder_id: Option<String>,
    pub parent_id: Option<String>,
    pub sort_order: i64,
    pub pinned_order: Option<i64>,
    pub created_at: String,
    pub type_id: Option<String>,
    pub image_asset_id: Option<String>,
    pub wiki_visible: i64,
}

/// Where a document is, and whether it is in the trash.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PlaceRow {
    pub folder_id: Option<String>,
    pub parent_id: Option<String>,
    pub trashed: bool,
}

/// An item of a place (root, folder or parent document), with its order.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OrderRow {
    pub id: String,
    pub sort_order: i64,
}

pub async fn all_folders(pool: &SqlitePool) -> AppResult<Vec<FolderRow>> {
    Ok(sqlx::query_as!(
        FolderRow,
        "SELECT id, parent_id, name, icon, sort_order, created_at
         FROM folders ORDER BY sort_order, created_at"
    )
    .fetch_all(pool)
    .await?)
}

pub async fn live_documents(pool: &SqlitePool) -> AppResult<Vec<TreeDocumentRow>> {
    Ok(sqlx::query_as!(
        TreeDocumentRow,
        r#"SELECT d.id AS "id!", d.kind, d.title, d.folder_id, d.parent_id, d.sort_order,
                  d.pinned_order, d.created_at, c.type_id, c.image_asset_id, d.wiki_visible
           FROM documents d LEFT JOIN cards c ON c.document_id = d.id
           WHERE d.trashed_at IS NULL
           ORDER BY d.sort_order, d.created_at"#
    )
    .fetch_all(pool)
    .await?)
}

pub async fn folder(tx: &mut Transaction<'_, Sqlite>, id: &str) -> AppResult<Option<FolderRow>> {
    Ok(sqlx::query_as!(
        FolderRow,
        "SELECT id, parent_id, name, icon, sort_order, created_at FROM folders WHERE id = ?",
        id
    )
    .fetch_optional(&mut **tx)
    .await?)
}

pub async fn place(tx: &mut Transaction<'_, Sqlite>, id: &str) -> AppResult<Option<PlaceRow>> {
    Ok(sqlx::query_as!(
        PlaceRow,
        r#"SELECT folder_id, parent_id, trashed_at IS NOT NULL AS "trashed!: bool"
           FROM documents WHERE id = ?"#,
        id
    )
    .fetch_optional(&mut **tx)
    .await?)
}

/// Folders directly in `parent` (the root when `None`).
pub async fn folders_in(
    tx: &mut Transaction<'_, Sqlite>,
    parent: Option<&str>,
) -> AppResult<Vec<OrderRow>> {
    Ok(sqlx::query_as!(
        OrderRow,
        r#"SELECT id AS "id!", sort_order FROM folders
           WHERE parent_id IS ? ORDER BY sort_order, created_at"#,
        parent
    )
    .fetch_all(&mut **tx)
    .await?)
}

/// Live documents directly in `folder` (the root when `None`), not under a parent.
pub async fn documents_in(
    tx: &mut Transaction<'_, Sqlite>,
    folder: Option<&str>,
) -> AppResult<Vec<OrderRow>> {
    Ok(sqlx::query_as!(
        OrderRow,
        r#"SELECT id AS "id!", sort_order FROM documents
           WHERE folder_id IS ? AND parent_id IS NULL AND trashed_at IS NULL
           ORDER BY sort_order, created_at"#,
        folder
    )
    .fetch_all(&mut **tx)
    .await?)
}

/// Live children of `parent`.
pub async fn children_of(
    tx: &mut Transaction<'_, Sqlite>,
    parent: &str,
) -> AppResult<Vec<OrderRow>> {
    Ok(sqlx::query_as!(
        OrderRow,
        r#"SELECT id AS "id!", sort_order FROM documents
           WHERE parent_id = ? AND trashed_at IS NULL
           ORDER BY sort_order, created_at"#,
        parent
    )
    .fetch_all(&mut **tx)
    .await?)
}

/// Every live or trashed document whose parent is `parent` (tests).
#[cfg(test)]
pub async fn all_children_of(
    tx: &mut Transaction<'_, Sqlite>,
    parent: &str,
) -> AppResult<Vec<String>> {
    Ok(sqlx::query_scalar!(
        r#"SELECT id AS "id!" FROM documents WHERE parent_id = ?"#,
        parent
    )
    .fetch_all(&mut **tx)
    .await?)
}

pub async fn set_document_order(
    tx: &mut Transaction<'_, Sqlite>,
    id: &str,
    order: i64,
) -> AppResult<()> {
    sqlx::query!(
        "UPDATE documents SET sort_order = ? WHERE id = ?",
        order,
        id
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn set_folder_order(
    tx: &mut Transaction<'_, Sqlite>,
    id: &str,
    order: i64,
) -> AppResult<()> {
    sqlx::query!("UPDATE folders SET sort_order = ? WHERE id = ?", order, id)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

pub async fn set_document_place(
    tx: &mut Transaction<'_, Sqlite>,
    id: &str,
    folder: Option<&str>,
    parent: Option<&str>,
) -> AppResult<()> {
    sqlx::query!(
        "UPDATE documents SET folder_id = ?, parent_id = ? WHERE id = ?",
        folder,
        parent,
        id
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn set_folder_parent(
    tx: &mut Transaction<'_, Sqlite>,
    id: &str,
    parent: Option<&str>,
) -> AppResult<()> {
    sqlx::query!("UPDATE folders SET parent_id = ? WHERE id = ?", parent, id)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

pub async fn insert_folder(tx: &mut Transaction<'_, Sqlite>, row: &FolderRow) -> AppResult<()> {
    sqlx::query!(
        "INSERT INTO folders (id, parent_id, name, icon, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?, ?)",
        row.id,
        row.parent_id,
        row.name,
        row.icon,
        row.sort_order,
        row.created_at,
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn set_folder_name_icon(
    tx: &mut Transaction<'_, Sqlite>,
    id: &str,
    name: &str,
    icon: &str,
) -> AppResult<()> {
    sqlx::query!(
        "UPDATE folders SET name = ?, icon = ? WHERE id = ?",
        name,
        icon,
        id
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub async fn delete_folder(tx: &mut Transaction<'_, Sqlite>, id: &str) -> AppResult<()> {
    sqlx::query!("DELETE FROM folders WHERE id = ?", id)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

/// `id` and every folder inside it, at any depth, deepest last.
pub async fn folder_subtree(tx: &mut Transaction<'_, Sqlite>, id: &str) -> AppResult<Vec<String>> {
    Ok(sqlx::query_scalar!(
        r#"WITH RECURSIVE sub(id, depth) AS (
               SELECT id, 0 FROM folders WHERE id = ?1
               UNION ALL
               SELECT f.id, sub.depth + 1 FROM folders f JOIN sub ON f.parent_id = sub.id
           )
           SELECT id AS "id!" FROM sub ORDER BY depth"#,
        id
    )
    .fetch_all(&mut **tx)
    .await?)
}

/// Live documents directly in `folder` (not under a parent), as ids.
pub async fn live_documents_in_folder(
    tx: &mut Transaction<'_, Sqlite>,
    folder: &str,
) -> AppResult<Vec<String>> {
    Ok(sqlx::query_scalar!(
        r#"SELECT id AS "id!" FROM documents
           WHERE folder_id = ? AND parent_id IS NULL AND trashed_at IS NULL"#,
        folder
    )
    .fetch_all(&mut **tx)
    .await?)
}

pub async fn set_trashed(
    tx: &mut Transaction<'_, Sqlite>,
    id: &str,
    trashed_at: Option<&str>,
) -> AppResult<()> {
    sqlx::query!(
        "UPDATE documents SET trashed_at = ? WHERE id = ?",
        trashed_at,
        id
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Whether a folder exists.
pub async fn folder_exists(tx: &mut Transaction<'_, Sqlite>, id: &str) -> AppResult<bool> {
    Ok(sqlx::query_scalar!(
        r#"SELECT COUNT(*) AS "n!: i64" FROM folders WHERE id = ?"#,
        id
    )
    .fetch_one(&mut **tx)
    .await?
        > 0)
}

// --- Pins ---------------------------------------------------------------------

/// Live pinned documents, in their pin order.
pub async fn live_pins(tx: &mut Transaction<'_, Sqlite>) -> AppResult<Vec<String>> {
    Ok(sqlx::query_scalar!(
        r#"SELECT id AS "id!" FROM documents
           WHERE trashed_at IS NULL AND pinned_order IS NOT NULL
           ORDER BY pinned_order, created_at, id"#
    )
    .fetch_all(&mut **tx)
    .await?)
}

/// Position among the pins of any document (live or trashed): `None` when
/// the document does not exist, `Some(None)` when it is not pinned.
pub async fn pinned_order(
    tx: &mut Transaction<'_, Sqlite>,
    id: &str,
) -> AppResult<Option<Option<i64>>> {
    Ok(
        sqlx::query_scalar!("SELECT pinned_order FROM documents WHERE id = ?", id)
            .fetch_optional(&mut **tx)
            .await?,
    )
}

pub async fn set_pinned_order(
    tx: &mut Transaction<'_, Sqlite>,
    id: &str,
    order: Option<i64>,
) -> AppResult<()> {
    sqlx::query!(
        "UPDATE documents SET pinned_order = ? WHERE id = ?",
        order,
        id
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}
