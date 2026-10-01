//! Sidebar tree tests, on a real world (real migrations) in a temp folder.
//!
//! `outline` draws the tree as text: `Name/{…}` is a folder with its content,
//! `Title(…)` a document with its children, items in their order.

use super::*;
use crate::db;
use crate::domain::documents::{self, DocumentFilter};
use crate::world::{self, OpenWorld};

struct Fixture {
    _dir: tempfile::TempDir,
    world: OpenWorld,
}

impl Fixture {
    async fn new() -> Self {
        let dir = tempfile::tempdir().unwrap();
        let world = world::create(&dir.path().join("W"), "W", &db::MIGRATOR)
            .await
            .unwrap();
        Self { _dir: dir, world }
    }

    fn pool(&self) -> &SqlitePool {
        &self.world.pool
    }

    async fn doc(&self, title: &str) -> String {
        documents::create(self.pool(), DocumentKind::Card, title)
            .await
            .unwrap()
            .id
    }

    async fn folder(&self, parent: Option<&str>, name: &str) -> String {
        create_folder(self.pool(), parent, name, "folder")
            .await
            .unwrap()
            .id
    }

    async fn outline(&self) -> String {
        let tree = tree(self.pool()).await.unwrap();
        draw(&tree, &Place::Root)
    }
}

fn draw(tree: &DocumentTree, place: &Place) -> String {
    let mut items: Vec<(i32, String)> = Vec::new();
    match place {
        Place::Parent { id } => {
            for d in tree
                .documents
                .iter()
                .filter(|d| d.parent_id.as_ref() == Some(id))
            {
                items.push((d.sort_order, draw_document(tree, d)));
            }
        }
        Place::Root | Place::Folder { .. } => {
            let folder = match place {
                Place::Folder { id } => Some(id),
                _ => None,
            };
            for f in tree
                .folders
                .iter()
                .filter(|f| f.parent_id.as_ref() == folder)
            {
                let inner = draw(tree, &Place::Folder { id: f.id.clone() });
                items.push((f.sort_order, format!("{}/{{{inner}}}", f.name)));
            }
            for d in tree
                .documents
                .iter()
                .filter(|d| d.parent_id.is_none() && d.folder_id.as_ref() == folder)
            {
                items.push((d.sort_order, draw_document(tree, d)));
            }
        }
    }
    items.sort_by_key(|(order, _)| *order);
    let orders: Vec<i32> = items.iter().map(|(order, _)| *order).collect();
    let expected: Vec<i32> = (0..i32::try_from(items.len()).unwrap()).collect();
    assert_eq!(orders, expected, "orders of {place:?} are not 0..n");
    items
        .into_iter()
        .map(|(_, text)| text)
        .collect::<Vec<_>>()
        .join(" ")
}

fn draw_document(tree: &DocumentTree, d: &TreeDocument) -> String {
    let children = draw(tree, &Place::Parent { id: d.id.clone() });
    if children.is_empty() {
        d.title.clone()
    } else {
        format!("{}({children})", d.title)
    }
}

fn root() -> Place {
    Place::Root
}

fn folder(id: &str) -> Place {
    Place::Folder { id: id.to_owned() }
}

fn under(id: &str) -> Place {
    Place::Parent { id: id.to_owned() }
}

// --- Order and moves ----------------------------------------------------------

#[tokio::test]
async fn new_documents_go_at_the_end_of_the_root() {
    let fx = Fixture::new().await;
    fx.doc("Gondor").await;
    fx.doc("Aragorn").await;
    fx.doc("Rohan").await;

    assert_eq!(fx.outline().await, "Gondor Aragorn Rohan");
}

#[tokio::test]
async fn a_document_moves_before_and_after_others() {
    let fx = Fixture::new().await;
    let a = fx.doc("A").await;
    fx.doc("B").await;
    let c = fx.doc("C").await;

    move_document(fx.pool(), &c, &root(), 0).await.unwrap();
    assert_eq!(fx.outline().await, "C A B");
    move_document(fx.pool(), &a, &root(), 99).await.unwrap();
    assert_eq!(fx.outline().await, "C B A");
}

#[tokio::test]
async fn a_hierarchy_is_built_and_children_follow_their_parent() {
    let fx = Fixture::new().await;
    let kingdom = fx.doc("Royaume").await;
    let city = fx.doc("Ville").await;
    let tavern = fx.doc("Taverne").await;
    let characters = fx.folder(None, "Lieux").await;

    move_document(fx.pool(), &city, &under(&kingdom), 0)
        .await
        .unwrap();
    move_document(fx.pool(), &tavern, &under(&city), 0)
        .await
        .unwrap();
    assert_eq!(fx.outline().await, "Royaume(Ville(Taverne)) Lieux/{}");

    move_document(fx.pool(), &kingdom, &folder(&characters), 0)
        .await
        .unwrap();
    assert_eq!(fx.outline().await, "Lieux/{Royaume(Ville(Taverne))}");
}

#[tokio::test]
async fn folders_and_documents_share_one_order() {
    let fx = Fixture::new().await;
    fx.doc("A").await;
    let b = fx.doc("B").await;
    let folder_id = fx.folder(None, "Dossier").await;

    move_folder(fx.pool(), &folder_id, None, 1).await.unwrap();
    assert_eq!(fx.outline().await, "A Dossier/{} B");
    move_document(fx.pool(), &b, &folder(&folder_id), 0)
        .await
        .unwrap();
    assert_eq!(fx.outline().await, "A Dossier/{B}");
}

#[tokio::test]
async fn cycles_are_refused_and_change_nothing() {
    let fx = Fixture::new().await;
    let kingdom = fx.doc("Royaume").await;
    let city = fx.doc("Ville").await;
    let tavern = fx.doc("Taverne").await;
    move_document(fx.pool(), &city, &under(&kingdom), 0)
        .await
        .unwrap();
    move_document(fx.pool(), &tavern, &under(&city), 0)
        .await
        .unwrap();
    let before = fx.outline().await;

    for (id, parent) in [(&kingdom, &tavern), (&kingdom, &kingdom), (&city, &tavern)] {
        let error = move_document(fx.pool(), id, &under(parent), 0)
            .await
            .unwrap_err();
        assert!(matches!(error, AppError::InvalidInput(_)), "{error:?}");
    }
    assert_eq!(fx.outline().await, before);

    let outer = fx.folder(None, "Extérieur").await;
    let inner = fx.folder(Some(&outer), "Intérieur").await;
    let deep = fx.folder(Some(&inner), "Profond").await;
    let folders_before = fx.outline().await;
    for target in [&outer, &inner, &deep] {
        let error = move_folder(fx.pool(), &outer, Some(target), 0)
            .await
            .unwrap_err();
        assert!(matches!(error, AppError::InvalidInput(_)), "{error:?}");
    }
    assert_eq!(fx.outline().await, folders_before);
}

#[tokio::test]
async fn unknown_targets_are_refused() {
    let fx = Fixture::new().await;
    let a = fx.doc("A").await;
    for place in [folder("nowhere"), under("nobody")] {
        let error = move_document(fx.pool(), &a, &place, 0).await.unwrap_err();
        assert!(matches!(error, AppError::InvalidInput(_)), "{error:?}");
    }
    let error = move_document(fx.pool(), "nobody", &root(), 0)
        .await
        .unwrap_err();
    assert!(matches!(error, AppError::InvalidInput(_)), "{error:?}");
}

#[tokio::test]
async fn the_order_stays_dense_after_many_moves() {
    let fx = Fixture::new().await;
    let mut ids = Vec::new();
    for n in 0..8 {
        ids.push(fx.doc(&format!("D{n}")).await);
    }
    let folder_id = fx.folder(None, "F").await;
    for (step, id) in ids.iter().enumerate().cycle().take(40) {
        let place = if step % 3 == 0 {
            folder(&folder_id)
        } else {
            root()
        };
        move_document(fx.pool(), id, &place, (step * 7) % 5)
            .await
            .unwrap();
    }
    // `outline` checks every place is numbered 0..n.
    fx.outline().await;
}

// --- Trash --------------------------------------------------------------------

#[tokio::test]
async fn trashing_a_parent_keeps_its_children_in_its_place() {
    let fx = Fixture::new().await;
    fx.doc("Avant").await;
    let kingdom = fx.doc("Royaume").await;
    fx.doc("Après").await;
    let city = fx.doc("Ville").await;
    let port = fx.doc("Port").await;
    move_document(fx.pool(), &city, &under(&kingdom), 0)
        .await
        .unwrap();
    move_document(fx.pool(), &port, &under(&kingdom), 1)
        .await
        .unwrap();
    assert_eq!(fx.outline().await, "Avant Royaume(Ville Port) Après");

    documents::trash(fx.pool(), &kingdom).await.unwrap();

    assert_eq!(fx.outline().await, "Avant Ville Port Après");
}

#[tokio::test]
async fn a_restored_document_goes_back_to_its_place_or_the_root() {
    let fx = Fixture::new().await;
    let places = fx.folder(None, "Lieux").await;
    let gondor = fx.doc("Gondor").await;
    let osgiliath = fx.doc("Osgiliath").await;
    move_document(fx.pool(), &gondor, &folder(&places), 0)
        .await
        .unwrap();
    move_document(fx.pool(), &osgiliath, &under(&gondor), 0)
        .await
        .unwrap();

    // Back in its folder, at the end.
    documents::trash(fx.pool(), &gondor).await.unwrap();
    documents::restore(fx.pool(), &gondor).await.unwrap();
    assert_eq!(fx.outline().await, "Lieux/{Osgiliath Gondor}");

    // Its parent is in the trash: back at the root.
    move_document(fx.pool(), &osgiliath, &under(&gondor), 0)
        .await
        .unwrap();
    documents::trash(fx.pool(), &osgiliath).await.unwrap();
    documents::trash(fx.pool(), &gondor).await.unwrap();
    documents::restore(fx.pool(), &osgiliath).await.unwrap();
    assert_eq!(fx.outline().await, "Lieux/{} Osgiliath");

    // Its folder was deleted: back at the root.
    documents::delete_forever(fx.pool(), &gondor).await.unwrap();
    let elsewhere = fx.folder(None, "Ailleurs").await;
    move_document(fx.pool(), &osgiliath, &folder(&elsewhere), 0)
        .await
        .unwrap();
    documents::trash(fx.pool(), &osgiliath).await.unwrap();
    delete_folder(fx.pool(), &elsewhere, FolderDeletion::Lift)
        .await
        .unwrap();
    documents::restore(fx.pool(), &osgiliath).await.unwrap();
    assert_eq!(fx.outline().await, "Lieux/{} Osgiliath");
}

#[tokio::test]
async fn a_document_deleted_for_good_leaves_no_child_pointing_to_it() {
    let fx = Fixture::new().await;
    let parent = fx.doc("Parent").await;
    let child = fx.doc("Enfant").await;
    move_document(fx.pool(), &child, &under(&parent), 0)
        .await
        .unwrap();
    documents::trash(fx.pool(), &child).await.unwrap();
    documents::trash(fx.pool(), &parent).await.unwrap();

    documents::delete_forever(fx.pool(), &parent).await.unwrap();

    assert!(children_ids(fx.pool(), &parent).await.unwrap().is_empty());
    documents::restore(fx.pool(), &child).await.unwrap();
    assert_eq!(fx.outline().await, "Enfant");
}

// --- Folders ------------------------------------------------------------------

#[tokio::test]
async fn folders_are_created_renamed_and_nested() {
    let fx = Fixture::new().await;
    let characters = fx.folder(None, "  Personnages ").await;
    let nobles = fx.folder(Some(&characters), "Nobles").await;
    update_folder(
        fx.pool(),
        &nobles,
        &FolderPatch {
            name: Some("Nobles de Gondor".into()),
            icon: Some("crown".into()),
        },
    )
    .await
    .unwrap();

    assert_eq!(fx.outline().await, "Personnages/{Nobles de Gondor/{}}");
    let tree = tree(fx.pool()).await.unwrap();
    let nobles = tree.folders.iter().find(|f| f.id == nobles).unwrap();
    assert_eq!(nobles.icon, "crown");
}

#[tokio::test]
async fn invalid_folders_are_refused() {
    let fx = Fixture::new().await;
    let long = "x".repeat(MAX_FOLDER_NAME_LEN + 1);
    for (name, icon) in [
        ("  ", "folder"),
        (long.as_str(), "folder"),
        ("Ok", ""),
        ("Ok", "../x"),
    ] {
        let error = create_folder(fx.pool(), None, name, icon)
            .await
            .unwrap_err();
        assert!(
            matches!(error, AppError::InvalidInput(_)),
            "{name} {icon}: {error:?}"
        );
    }
    let error = create_folder(fx.pool(), Some("nowhere"), "Ok", "folder")
        .await
        .unwrap_err();
    assert!(matches!(error, AppError::InvalidInput(_)), "{error:?}");
}

#[tokio::test]
async fn deleting_a_folder_can_lift_its_content_in_its_place() {
    let fx = Fixture::new().await;
    fx.doc("Avant").await;
    let places = fx.folder(None, "Lieux").await;
    fx.doc("Après").await;
    let cities = fx.folder(Some(&places), "Villes").await;
    let gondor = fx.doc("Gondor").await;
    move_document(fx.pool(), &gondor, &folder(&places), 1)
        .await
        .unwrap();
    assert_eq!(fx.outline().await, "Avant Lieux/{Villes/{} Gondor} Après");

    delete_folder(fx.pool(), &places, FolderDeletion::Lift)
        .await
        .unwrap();

    assert_eq!(fx.outline().await, "Avant Villes/{} Gondor Après");
    let tree = tree(fx.pool()).await.unwrap();
    assert!(tree.folders.iter().all(|f| f.id != places));
    assert!(
        tree.folders
            .iter()
            .any(|f| f.id == cities && f.parent_id.is_none())
    );
}

#[tokio::test]
async fn deleting_a_folder_can_trash_its_content() {
    let fx = Fixture::new().await;
    let places = fx.folder(None, "Lieux").await;
    let cities = fx.folder(Some(&places), "Villes").await;
    let gondor = fx.doc("Gondor").await;
    let minas = fx.doc("Minas Tirith").await;
    let tavern = fx.doc("Taverne").await;
    fx.doc("Ailleurs").await;
    move_document(fx.pool(), &gondor, &folder(&places), 0)
        .await
        .unwrap();
    move_document(fx.pool(), &minas, &folder(&cities), 0)
        .await
        .unwrap();
    move_document(fx.pool(), &tavern, &under(&minas), 0)
        .await
        .unwrap();

    delete_folder(fx.pool(), &places, FolderDeletion::Trash)
        .await
        .unwrap();

    assert_eq!(fx.outline().await, "Ailleurs");
    let trash = documents::list(
        fx.pool(),
        &DocumentFilter {
            kind: None,
            trashed: true,
        },
    )
    .await
    .unwrap();
    let mut trashed: Vec<&str> = trash.iter().map(|d| d.title.as_str()).collect();
    trashed.sort_unstable();
    assert_eq!(trashed, ["Gondor", "Minas Tirith", "Taverne"]);
    assert!(tree(fx.pool()).await.unwrap().folders.is_empty());

    // Restored, they come back at the root.
    documents::restore(fx.pool(), &gondor).await.unwrap();
    assert_eq!(fx.outline().await, "Ailleurs Gondor");
}

// --- Migration ----------------------------------------------------------------

/// The migrations of the 0.3.0 app (schema 6), loaded from a copy of the
/// first six files: the world below is made exactly as that version made it.
async fn migrator_0_3_0(dir: &std::path::Path) -> sqlx::migrate::Migrator {
    let source = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("migrations");
    std::fs::create_dir_all(dir).unwrap();
    for entry in std::fs::read_dir(&source).unwrap() {
        let path = entry.unwrap().path();
        let name = path.file_name().unwrap().to_string_lossy().into_owned();
        let version: u32 = name.split('_').next().unwrap().parse().unwrap();
        if version <= 6 {
            std::fs::copy(&path, dir.join(&name)).unwrap();
        }
    }
    sqlx::migrate::Migrator::new(dir).await.unwrap()
}

#[tokio::test]
async fn a_world_of_0_3_0_opens_with_its_cards_at_the_root_in_creation_order() {
    let dir = tempfile::tempdir().unwrap();
    let old = migrator_0_3_0(&dir.path().join("migrations")).await;
    let root_path = dir.path().join("Ancien");
    let world = world::create(&root_path, "Ancien", &old).await.unwrap();
    // Created in this order, titles not in alphabetical order.
    for (n, title) in ["Rohan", "Aragorn", "Gondor"].iter().enumerate() {
        sqlx::query(
            "INSERT INTO documents (id, kind, title, created_at, updated_at) VALUES (?, 'card', ?, ?, ?)",
        )
        .bind(format!("id-{n}"))
        .bind(*title)
        .bind(format!("2026-09-2{n}T10:00:00Z"))
        .bind(format!("2026-09-2{n}T10:00:00Z"))
        .execute(&world.pool)
        .await
        .unwrap();
    }
    world.close().await;

    let reopened = world::open(&root_path, &db::MIGRATOR).await.unwrap();

    assert_eq!(reopened.info().schema_version, 7);
    let tree = tree(&reopened.pool).await.unwrap();
    assert!(tree.folders.is_empty());
    assert_eq!(draw(&tree, &Place::Root), "Rohan Aragorn Gondor");
    assert!(tree.documents.iter().all(|d| d.pinned_order.is_none()));
    reopened.close().await;
}

// --- Concurrency (#140) -----------------------------------------------------------

/// Writes running at the same time (an autosave and a move, say) wait for
/// each other instead of failing with "database is locked".
#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn concurrent_writes_all_succeed() {
    let fx = Fixture::new().await;
    let shelf = fx.folder(None, "Shelf").await;

    let creations = (0..40).map(|i| {
        let pool = fx.pool().clone();
        tokio::spawn(async move {
            documents::create(&pool, DocumentKind::Card, &format!("C{i}"))
                .await
                .map(|document| document.id)
        })
    });
    let mut ids = Vec::new();
    for task in creations.collect::<Vec<_>>() {
        ids.push(task.await.unwrap().expect("a concurrent creation failed"));
    }

    let moves = ids.iter().enumerate().map(|(i, id)| {
        let pool = fx.pool().clone();
        let (id, shelf) = (id.clone(), shelf.clone());
        tokio::spawn(async move {
            let place = if i % 2 == 0 {
                Place::Folder { id: shelf }
            } else {
                Place::Root
            };
            move_document(&pool, &id, &place, 0).await
        })
    });
    for task in moves.collect::<Vec<_>>() {
        task.await.unwrap().expect("a concurrent move failed");
    }

    // Every place is still numbered 0..n, with every document in it.
    let tree = tree(fx.pool()).await.unwrap();
    assert_eq!(tree.documents.len(), 40);
    draw(&tree, &Place::Root);
}
