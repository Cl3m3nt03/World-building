//! Document and trash tests, on a real world (real migrations) in a temp folder.

use super::*;
use crate::db;
use crate::domain::links::{self, LinkKind};
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
}

fn live() -> DocumentFilter {
    DocumentFilter::default()
}

fn in_trash() -> DocumentFilter {
    DocumentFilter {
        kind: None,
        trashed: true,
    }
}

fn titles(documents: &[Document]) -> Vec<&str> {
    documents.iter().map(|d| d.title.as_str()).collect()
}

#[tokio::test]
async fn create_then_list_by_title() {
    let fx = Fixture::new().await;
    create(fx.pool(), DocumentKind::Card, "  Thorin ")
        .await
        .unwrap();
    create(fx.pool(), DocumentKind::Card, "aragorn")
        .await
        .unwrap();
    create(fx.pool(), DocumentKind::Map, "Terre du Milieu")
        .await
        .unwrap();

    let all = list(fx.pool(), &live()).await.unwrap();
    assert_eq!(titles(&all), ["aragorn", "Terre du Milieu", "Thorin"]);

    let cards = list(
        fx.pool(),
        &DocumentFilter {
            kind: Some(DocumentKind::Card),
            trashed: false,
        },
    )
    .await
    .unwrap();
    assert_eq!(titles(&cards), ["aragorn", "Thorin"]);
    assert!(cards.iter().all(|d| d.kind == DocumentKind::Card));
}

#[tokio::test]
async fn titles_are_trimmed_and_never_empty() {
    let fx = Fixture::new().await;
    assert!(matches!(
        create(fx.pool(), DocumentKind::Card, "   ").await,
        Err(AppError::InvalidInput(_))
    ));
    let long = "x".repeat(MAX_TITLE_LEN + 1);
    assert!(matches!(
        create(fx.pool(), DocumentKind::Card, &long).await,
        Err(AppError::InvalidInput(_))
    ));

    let card = create(fx.pool(), DocumentKind::Card, "Gandalf")
        .await
        .unwrap();
    let renamed = rename(fx.pool(), &card.id, " Gandalf le Blanc ")
        .await
        .unwrap();
    assert_eq!(renamed.title, "Gandalf le Blanc");
    assert!(renamed.updated_at >= card.updated_at);
    assert!(rename(fx.pool(), &card.id, "").await.is_err());
}

#[tokio::test]
async fn trash_is_reversible() {
    let fx = Fixture::new().await;
    let card = create(fx.pool(), DocumentKind::Card, "Frodon")
        .await
        .unwrap();

    let trashed = trash(fx.pool(), &card.id).await.unwrap();
    assert!(trashed.trashed_at.is_some());
    assert!(list(fx.pool(), &live()).await.unwrap().is_empty());
    assert_eq!(
        titles(&list(fx.pool(), &in_trash()).await.unwrap()),
        ["Frodon"]
    );

    let restored = restore(fx.pool(), &card.id).await.unwrap();
    assert_eq!(restored, card);
    assert!(list(fx.pool(), &in_trash()).await.unwrap().is_empty());
}

#[tokio::test]
async fn only_trashed_documents_can_be_deleted_for_good() {
    let fx = Fixture::new().await;
    let card = create(fx.pool(), DocumentKind::Card, "Sam").await.unwrap();

    assert!(matches!(
        delete_forever(fx.pool(), &card.id).await,
        Err(AppError::InvalidInput(_))
    ));

    trash(fx.pool(), &card.id).await.unwrap();
    delete_forever(fx.pool(), &card.id).await.unwrap();
    assert!(get(fx.pool(), &card.id).await.is_err());
}

#[tokio::test]
async fn deleting_for_good_keeps_links_to_it_as_dead_references() {
    let fx = Fixture::new().await;
    let pippin = create(fx.pool(), DocumentKind::Card, "Pippin")
        .await
        .unwrap();
    let shire = create(fx.pool(), DocumentKind::Card, "La Comté")
        .await
        .unwrap();
    let merry = create(fx.pool(), DocumentKind::Card, "Merry")
        .await
        .unwrap();
    // Pippin cites the Shire and Merry; Merry cites Pippin.
    links::replace(
        fx.pool(),
        &pippin.id,
        LinkKind::Mention,
        None,
        &[shire.id.clone(), merry.id.clone()],
    )
    .await
    .unwrap();
    links::replace(
        fx.pool(),
        &merry.id,
        LinkKind::Mention,
        None,
        std::slice::from_ref(&pippin.id),
    )
    .await
    .unwrap();

    trash(fx.pool(), &pippin.id).await.unwrap();
    // In the trash: nothing changes.
    assert_eq!(
        links::to_target(fx.pool(), &pippin.id).await.unwrap().len(),
        1
    );
    assert_eq!(
        links::to_target(fx.pool(), &shire.id).await.unwrap().len(),
        1
    );

    delete_forever(fx.pool(), &pippin.id).await.unwrap();
    // The links Pippin made are gone with it…
    assert!(
        links::to_target(fx.pool(), &shire.id)
            .await
            .unwrap()
            .is_empty()
    );
    // …but Merry's mention of Pippin stays, as a dead reference.
    let dead = links::to_target(fx.pool(), &pippin.id).await.unwrap();
    assert_eq!(dead.len(), 1);
    assert_eq!(dead[0].source_id, merry.id);
}

#[tokio::test]
async fn emptying_the_trash_deletes_only_trashed_documents() {
    let fx = Fixture::new().await;
    let kept = create(fx.pool(), DocumentKind::Card, "Gimli")
        .await
        .unwrap();
    for title in ["Boromir", "Saroumane"] {
        let doc = create(fx.pool(), DocumentKind::Card, title).await.unwrap();
        trash(fx.pool(), &doc.id).await.unwrap();
    }

    assert_eq!(empty_trash(fx.pool()).await.unwrap(), 2);
    assert!(list(fx.pool(), &in_trash()).await.unwrap().is_empty());
    assert_eq!(
        titles(&list(fx.pool(), &live()).await.unwrap()),
        [kept.title.as_str()]
    );
}

#[tokio::test]
async fn replacing_links_only_touches_one_detail() {
    let fx = Fixture::new().await;
    let aragorn = create(fx.pool(), DocumentKind::Card, "Aragorn")
        .await
        .unwrap();
    let gondor = create(fx.pool(), DocumentKind::Card, "Gondor")
        .await
        .unwrap();
    let rohan = create(fx.pool(), DocumentKind::Card, "Rohan")
        .await
        .unwrap();
    let birthplace = Some("prop-birthplace");
    let allies = Some("prop-allies");

    links::replace(
        fx.pool(),
        &aragorn.id,
        LinkKind::Property,
        birthplace,
        std::slice::from_ref(&gondor.id),
    )
    .await
    .unwrap();
    links::replace(
        fx.pool(),
        &aragorn.id,
        LinkKind::Property,
        allies,
        std::slice::from_ref(&rohan.id),
    )
    .await
    .unwrap();
    // The birthplace changes: the allies stay.
    links::replace(
        fx.pool(),
        &aragorn.id,
        LinkKind::Property,
        birthplace,
        std::slice::from_ref(&rohan.id),
    )
    .await
    .unwrap();

    assert!(
        links::to_target(fx.pool(), &gondor.id)
            .await
            .unwrap()
            .is_empty()
    );
    let to_rohan = links::to_target(fx.pool(), &rohan.id).await.unwrap();
    let details: Vec<&str> = to_rohan.iter().map(|l| l.detail.as_str()).collect();
    assert_eq!(details, ["prop-allies", "prop-birthplace"]);
}
