//! The sidebar tree (M3, docs/features/02-organisation.md): folders, parent /
//! child documents and the manual order.
//!
//! A document is in exactly one place: under a parent document, in a folder,
//! or at the root. In the root and in a folder, folders and documents share
//! one order; under a document, its children are ordered among themselves.
//! Every move renumbers the places it touches (0, 1, 2…) in one transaction,
//! so the order never has gaps or ties. Moves that would make a cycle are
//! refused.

use serde::{Deserialize, Serialize};
use specta::Type;
use sqlx::{Sqlite, SqlitePool, Transaction};
use uuid::Uuid;

use crate::db;
use crate::db::tree::{self as queries, FolderRow};
use crate::domain::documents::{self, DocumentKind};
use crate::error::{AppError, AppResult};

#[cfg(test)]
mod tests;

/// Longest folder name, in characters.
pub const MAX_FOLDER_NAME_LEN: usize = 100;
/// Longest icon name.
const MAX_ICON_LEN: usize = 40;
/// Deepest chain followed when looking for a cycle; deeper means broken data.
const MAX_DEPTH: usize = 10_000;

/// Where a document or a folder is.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum Place {
    Root,
    Folder {
        id: String,
    },
    /// Under a document (documents only).
    Parent {
        id: String,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Folder {
    pub id: String,
    /// Enclosing folder; `None` at the root.
    pub parent_id: Option<String>,
    pub name: String,
    pub icon: String,
    pub sort_order: i32,
}

/// A live document as the sidebar shows it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct TreeDocument {
    pub id: String,
    pub kind: DocumentKind,
    pub title: String,
    /// Its folder, when it is not under a parent.
    pub folder_id: Option<String>,
    pub parent_id: Option<String>,
    pub sort_order: i32,
    /// Position among the pinned documents; `None` when not pinned.
    pub pinned_order: Option<i32>,
    /// RFC 3339.
    pub created_at: String,
    /// For a card: its type and image.
    pub type_id: Option<String>,
    pub image_asset_id: Option<String>,
}

/// Everything the sidebar shows: folders and live documents, with their place
/// and order (the front builds the tree).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DocumentTree {
    pub folders: Vec<Folder>,
    pub documents: Vec<TreeDocument>,
}

/// What to do with a folder's content when deleting it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum FolderDeletion {
    /// Its folders and documents take its place, in the same order.
    Lift,
    /// Its documents (and their children) go to the trash; its folders are deleted.
    Trash,
}

/// Changes to a folder; absent fields are left as they are.
#[derive(Debug, Clone, Default, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct FolderPatch {
    pub name: Option<String>,
    pub icon: Option<String>,
}

fn to_i32(value: i64) -> i32 {
    i32::try_from(value).unwrap_or(i32::MAX)
}

impl From<FolderRow> for Folder {
    fn from(row: FolderRow) -> Self {
        Self {
            id: row.id,
            parent_id: row.parent_id,
            name: row.name,
            icon: row.icon,
            sort_order: to_i32(row.sort_order),
        }
    }
}

pub async fn tree(pool: &SqlitePool) -> AppResult<DocumentTree> {
    let folders = queries::all_folders(pool)
        .await?
        .into_iter()
        .map(Folder::from)
        .collect();
    let documents = queries::live_documents(pool)
        .await?
        .into_iter()
        .map(|row| {
            Ok(TreeDocument {
                kind: DocumentKind::parse(&row.kind)?,
                id: row.id,
                title: row.title,
                folder_id: row.folder_id,
                parent_id: row.parent_id,
                sort_order: to_i32(row.sort_order),
                pinned_order: row.pinned_order.map(to_i32),
                created_at: row.created_at,
                type_id: row.type_id,
                image_asset_id: row.image_asset_id,
            })
        })
        .collect::<AppResult<_>>()?;
    Ok(DocumentTree { folders, documents })
}

// --- Places and order ---------------------------------------------------------

/// An item of a place.
#[derive(Debug, Clone, PartialEq, Eq)]
enum Item {
    Folder(String),
    Document(String),
}

/// The items of `place` in their order. A place's folders come before its
/// documents on equal order (only possible in data from outside the app).
async fn items_of(tx: &mut Transaction<'_, Sqlite>, place: &Place) -> AppResult<Vec<Item>> {
    let mut ordered: Vec<(i64, u8, Item)> = Vec::new();
    match place {
        Place::Parent { id } => {
            for row in queries::children_of(tx, id).await? {
                ordered.push((row.sort_order, 1, Item::Document(row.id)));
            }
        }
        Place::Root | Place::Folder { .. } => {
            let folder = match place {
                Place::Folder { id } => Some(id.as_str()),
                _ => None,
            };
            for row in queries::folders_in(tx, folder).await? {
                ordered.push((row.sort_order, 0, Item::Folder(row.id)));
            }
            for row in queries::documents_in(tx, folder).await? {
                ordered.push((row.sort_order, 1, Item::Document(row.id)));
            }
        }
    }
    ordered.sort_by_key(|(order, rank, _)| (*order, *rank));
    Ok(ordered.into_iter().map(|(_, _, item)| item).collect())
}

/// Numbers `items` 0, 1, 2… in this order.
async fn write_order(tx: &mut Transaction<'_, Sqlite>, items: &[Item]) -> AppResult<()> {
    for (index, item) in items.iter().enumerate() {
        let order = i64::try_from(index).unwrap_or(i64::MAX);
        match item {
            Item::Folder(id) => queries::set_folder_order(tx, id, order).await?,
            Item::Document(id) => queries::set_document_order(tx, id, order).await?,
        }
    }
    Ok(())
}

/// Puts `item` at `index` of `place` (the end if `index` is past it).
async fn insert_at(
    tx: &mut Transaction<'_, Sqlite>,
    place: &Place,
    item: Item,
    index: usize,
) -> AppResult<()> {
    let mut items: Vec<Item> = items_of(tx, place)
        .await?
        .into_iter()
        .filter(|other| *other != item)
        .collect();
    items.insert(index.min(items.len()), item);
    write_order(tx, &items).await
}

/// Renumbers `place` (after an item left it).
async fn renumber(tx: &mut Transaction<'_, Sqlite>, place: &Place) -> AppResult<()> {
    let items = items_of(tx, place).await?;
    write_order(tx, &items).await
}

fn place_of(folder: Option<String>, parent: Option<String>) -> Place {
    match (parent, folder) {
        (Some(id), _) => Place::Parent { id },
        (None, Some(id)) => Place::Folder { id },
        (None, None) => Place::Root,
    }
}

/// The `(folder_id, parent_id)` columns of a document at `place`.
fn columns(place: &Place) -> (Option<&str>, Option<&str>) {
    match place {
        Place::Root => (None, None),
        Place::Folder { id } => (Some(id), None),
        Place::Parent { id } => (None, Some(id)),
    }
}

/// The number of items at the root: where a new document goes.
pub(crate) async fn root_len(tx: &mut Transaction<'_, Sqlite>) -> AppResult<i64> {
    Ok(i64::try_from(items_of(tx, &Place::Root).await?.len()).unwrap_or(i64::MAX))
}

// --- Documents ----------------------------------------------------------------

async fn live_place(tx: &mut Transaction<'_, Sqlite>, id: &str) -> AppResult<Place> {
    let row = queries::place(tx, id)
        .await?
        .ok_or_else(|| AppError::InvalidInput(format!("document not found: {id}")))?;
    if row.trashed {
        return Err(AppError::InvalidInput(format!(
            "document in the trash: {id}"
        )));
    }
    Ok(place_of(row.folder_id, row.parent_id))
}

/// Whether `id` is `start` or one of `start`'s parents, up the parent chain.
async fn is_parent_chain_through(
    tx: &mut Transaction<'_, Sqlite>,
    start: &str,
    id: &str,
) -> AppResult<bool> {
    let mut current = start.to_owned();
    for _ in 0..MAX_DEPTH {
        if current == id {
            return Ok(true);
        }
        match queries::place(tx, &current)
            .await?
            .and_then(|row| row.parent_id)
        {
            Some(parent) => current = parent,
            None => return Ok(false),
        }
    }
    Err(AppError::Internal(format!(
        "parent chain too deep from {start}"
    )))
}

/// Checks that `place` exists and can receive the document `id`.
async fn check_document_target(
    tx: &mut Transaction<'_, Sqlite>,
    id: &str,
    place: &Place,
) -> AppResult<()> {
    match place {
        Place::Root => Ok(()),
        Place::Folder { id: folder } => {
            if queries::folder_exists(tx, folder).await? {
                Ok(())
            } else {
                Err(AppError::InvalidInput(format!(
                    "folder not found: {folder}"
                )))
            }
        }
        Place::Parent { id: parent } => {
            live_place(tx, parent).await?;
            if is_parent_chain_through(tx, parent, id).await? {
                Err(AppError::InvalidInput(format!(
                    "a document cannot go under itself or its own descendant: {id} under {parent}"
                )))
            } else {
                Ok(())
            }
        }
    }
}

/// Moves a live document to `index` of `place`, with its children (they stay
/// under it).
pub async fn move_document(
    pool: &SqlitePool,
    id: &str,
    place: &Place,
    index: usize,
) -> AppResult<()> {
    let mut tx = db::begin_write(pool).await?;
    let from = live_place(&mut tx, id).await?;
    check_document_target(&mut tx, id, place).await?;
    let (folder, parent) = columns(place);
    queries::set_document_place(&mut tx, id, folder, parent).await?;
    if from != *place {
        renumber(&mut tx, &from).await?;
    }
    insert_at(&mut tx, place, Item::Document(id.to_owned()), index).await?;
    tx.commit().await?;
    Ok(())
}

/// Puts a document in the trash. Its live children do not go with it: they
/// take its place, in their order. It keeps its own place, to go back there
/// when restored.
pub async fn trash_document(
    tx: &mut Transaction<'_, Sqlite>,
    id: &str,
    now: &str,
) -> AppResult<()> {
    let place = live_place(tx, id).await?;
    let items = items_of(tx, &place).await?;
    let index = items
        .iter()
        .position(|item| *item == Item::Document(id.to_owned()))
        .unwrap_or(items.len());
    let children: Vec<Item> = queries::children_of(tx, id)
        .await?
        .into_iter()
        .map(|row| Item::Document(row.id))
        .collect();

    queries::set_trashed(tx, id, Some(now)).await?;
    let (folder, parent) = columns(&place);
    for child in &children {
        if let Item::Document(child_id) = child {
            queries::set_document_place(tx, child_id, folder, parent).await?;
        }
    }
    let mut lifted: Vec<Item> = items
        .into_iter()
        .filter(|item| *item != Item::Document(id.to_owned()))
        .collect();
    let at = index.min(lifted.len());
    lifted.splice(at..at, children);
    write_order(tx, &lifted).await
}

/// Takes a document out of the trash, back to its place (at the end) if that
/// place still exists out of the trash, else at the end of the root.
pub async fn restore_document(tx: &mut Transaction<'_, Sqlite>, id: &str) -> AppResult<()> {
    let row = queries::place(tx, id)
        .await?
        .ok_or_else(|| AppError::InvalidInput(format!("document not found: {id}")))?;
    if !row.trashed {
        return Ok(());
    }
    let wanted = place_of(row.folder_id, row.parent_id);
    let place = match check_document_target(tx, id, &wanted).await {
        Ok(()) => wanted,
        Err(_) => Place::Root,
    };
    let (folder, parent) = columns(&place);
    queries::set_document_place(tx, id, folder, parent).await?;
    queries::set_trashed(tx, id, None).await?;
    insert_at(tx, &place, Item::Document(id.to_owned()), usize::MAX).await
}

/// Every live document under `id`, at any depth.
async fn live_descendants(tx: &mut Transaction<'_, Sqlite>, id: &str) -> AppResult<Vec<String>> {
    let mut found = Vec::new();
    let mut next = vec![id.to_owned()];
    while let Some(current) = next.pop() {
        if found.len() > MAX_DEPTH {
            return Err(AppError::Internal(format!(
                "too many descendants under {id}"
            )));
        }
        for child in queries::children_of(tx, &current).await? {
            next.push(child.id.clone());
            found.push(child.id);
        }
    }
    Ok(found)
}

// --- Folders ------------------------------------------------------------------

/// A folder name trimmed, non-empty and not too long.
pub fn validate_folder_name(name: &str) -> AppResult<String> {
    let name = name.trim();
    if name.is_empty() {
        return Err(AppError::InvalidInput(
            "a folder name cannot be empty".into(),
        ));
    }
    if name.chars().count() > MAX_FOLDER_NAME_LEN {
        return Err(AppError::InvalidInput(format!(
            "a folder name is at most {MAX_FOLDER_NAME_LEN} characters"
        )));
    }
    Ok(name.to_owned())
}

fn validate_icon(icon: &str) -> AppResult<String> {
    let valid = !icon.is_empty()
        && icon.len() <= MAX_ICON_LEN
        && icon
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-');
    if valid {
        Ok(icon.to_owned())
    } else {
        Err(AppError::InvalidInput(format!(
            "invalid icon name: {icon:?}"
        )))
    }
}

async fn folder_row(tx: &mut Transaction<'_, Sqlite>, id: &str) -> AppResult<FolderRow> {
    queries::folder(tx, id)
        .await?
        .ok_or_else(|| AppError::InvalidInput(format!("folder not found: {id}")))
}

fn folder_place(parent: Option<String>) -> Place {
    match parent {
        Some(id) => Place::Folder { id },
        None => Place::Root,
    }
}

/// Creates a folder at the end of `parent` (the root when `None`).
pub async fn create_folder(
    pool: &SqlitePool,
    parent: Option<&str>,
    name: &str,
    icon: &str,
) -> AppResult<Folder> {
    let name = validate_folder_name(name)?;
    let icon = validate_icon(icon)?;
    let mut tx = db::begin_write(pool).await?;
    if let Some(parent) = parent {
        folder_row(&mut tx, parent).await?;
    }
    let place = folder_place(parent.map(str::to_owned));
    let order = i64::try_from(items_of(&mut tx, &place).await?.len()).unwrap_or(i64::MAX);
    let row = FolderRow {
        id: Uuid::new_v4().to_string(),
        parent_id: parent.map(str::to_owned),
        name,
        icon,
        sort_order: order,
        created_at: documents::now(),
    };
    queries::insert_folder(&mut tx, &row).await?;
    tx.commit().await?;
    Ok(row.into())
}

pub async fn update_folder(pool: &SqlitePool, id: &str, patch: &FolderPatch) -> AppResult<Folder> {
    let mut tx = db::begin_write(pool).await?;
    let row = folder_row(&mut tx, id).await?;
    let name = match &patch.name {
        Some(name) => validate_folder_name(name)?,
        None => row.name.clone(),
    };
    let icon = match &patch.icon {
        Some(icon) => validate_icon(icon)?,
        None => row.icon.clone(),
    };
    queries::set_folder_name_icon(&mut tx, id, &name, &icon).await?;
    let updated = folder_row(&mut tx, id).await?;
    tx.commit().await?;
    Ok(updated.into())
}

/// Moves a folder, with its content, to `index` of `parent` (the root when
/// `None`). A folder cannot go into itself or one of its subfolders.
pub async fn move_folder(
    pool: &SqlitePool,
    id: &str,
    parent: Option<&str>,
    index: usize,
) -> AppResult<()> {
    let mut tx = db::begin_write(pool).await?;
    let row = folder_row(&mut tx, id).await?;
    if let Some(target) = parent {
        folder_row(&mut tx, target).await?;
        if queries::folder_subtree(&mut tx, id)
            .await?
            .iter()
            .any(|inside| inside == target)
        {
            return Err(AppError::InvalidInput(format!(
                "a folder cannot go into itself or one of its subfolders: {id} into {target}"
            )));
        }
    }
    let from = folder_place(row.parent_id);
    let to = folder_place(parent.map(str::to_owned));
    queries::set_folder_parent(&mut tx, id, parent).await?;
    if from != to {
        renumber(&mut tx, &from).await?;
    }
    insert_at(&mut tx, &to, Item::Folder(id.to_owned()), index).await?;
    tx.commit().await?;
    Ok(())
}

/// Deletes a folder: its content takes its place (`Lift`), or its documents
/// go to the trash with their children and its subfolders are deleted
/// (`Trash`; restored, they come back at the root).
pub async fn delete_folder(pool: &SqlitePool, id: &str, mode: FolderDeletion) -> AppResult<()> {
    let mut tx = db::begin_write(pool).await?;
    let row = folder_row(&mut tx, id).await?;
    let container = folder_place(row.parent_id.clone());
    let items = items_of(&mut tx, &container).await?;
    let index = items
        .iter()
        .position(|item| *item == Item::Folder(id.to_owned()))
        .unwrap_or(items.len());
    let mut remaining: Vec<Item> = items
        .into_iter()
        .filter(|item| *item != Item::Folder(id.to_owned()))
        .collect();

    match mode {
        FolderDeletion::Lift => {
            let inner = items_of(&mut tx, &Place::Folder { id: id.to_owned() }).await?;
            for item in &inner {
                match item {
                    Item::Folder(sub) => {
                        queries::set_folder_parent(&mut tx, sub, row.parent_id.as_deref()).await?;
                    }
                    Item::Document(document) => {
                        queries::set_document_place(
                            &mut tx,
                            document,
                            row.parent_id.as_deref(),
                            None,
                        )
                        .await?;
                    }
                }
            }
            let at = index.min(remaining.len());
            remaining.splice(at..at, inner);
            queries::delete_folder(&mut tx, id).await?;
        }
        FolderDeletion::Trash => {
            let subtree = queries::folder_subtree(&mut tx, id).await?;
            let now = documents::now();
            for folder in &subtree {
                for document in queries::live_documents_in_folder(&mut tx, folder).await? {
                    for descendant in live_descendants(&mut tx, &document).await? {
                        queries::set_trashed(&mut tx, &descendant, Some(&now)).await?;
                    }
                    queries::set_trashed(&mut tx, &document, Some(&now)).await?;
                }
            }
            // Deepest first: a folder is deleted once its subfolders are gone.
            for folder in subtree.iter().rev() {
                queries::delete_folder(&mut tx, folder).await?;
            }
        }
    }
    write_order(&mut tx, &remaining).await?;
    tx.commit().await?;
    Ok(())
}

/// Every document id with a parent (live or trashed) equal to `id`; used by
/// tests to check nothing points to a deleted parent.
#[cfg(test)]
pub(crate) async fn children_ids(pool: &SqlitePool, id: &str) -> AppResult<Vec<String>> {
    let mut tx = db::begin_write(pool).await?;
    let ids = queries::all_children_of(&mut tx, id).await?;
    tx.commit().await?;
    Ok(ids)
}
