//! Card tests, on a real world (real migrations) in a temp folder.

use super::*;
use crate::db;
use crate::domain::card_types::{self, NewCardType};
use crate::domain::documents::DocumentFilter;
use crate::domain::media;
use crate::world::{self, OpenWorld};

/// A valid 1×1 PNG.
const PIXEL_PNG: &[u8] = &[
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
    0x89, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x44, 0x41, 0x54, 0x78, 0xDA, 0x63, 0xFC, 0xCF, 0xC0, 0x50,
    0x0F, 0x00, 0x04, 0x85, 0x01, 0x80, 0x84, 0xA9, 0x8C, 0x21, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
    0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
];

struct Fixture {
    dir: tempfile::TempDir,
    world: OpenWorld,
}

impl Fixture {
    async fn new() -> Self {
        let dir = tempfile::tempdir().unwrap();
        let world = world::create(&dir.path().join("W"), "W", &db::MIGRATOR)
            .await
            .unwrap();
        Self { dir, world }
    }

    fn pool(&self) -> &SqlitePool {
        &self.world.pool
    }

    async fn new_type(&self, name: &str, parent: Option<&str>) -> String {
        card_types::create(
            self.pool(),
            NewCardType {
                parent_id: parent.map(str::to_owned),
                name: name.into(),
                icon: "user".into(),
                color: "blue".into(),
            },
        )
        .await
        .unwrap()
        .id
    }

    async fn image(&self) -> String {
        let source = self.dir.path().join("portrait.png");
        std::fs::write(&source, PIXEL_PNG).unwrap();
        media::import(self.pool(), &self.world.assets_dir(), &source)
            .await
            .unwrap()
            .asset
            .id
    }
}

#[tokio::test]
async fn create_and_edit_a_card() {
    let fx = Fixture::new().await;
    let character = fx.new_type("Personnage", None).await;
    let place = fx.new_type("Lieu", None).await;
    let city = fx.new_type("Ville", Some(&place)).await;

    let card = create(fx.pool(), &character, " Aragorn ").await.unwrap();
    assert_eq!(card.title, "Aragorn");
    assert_eq!(card.type_id.as_deref(), Some(character.as_str()));
    assert!(card.aliases.is_empty());

    // It is a document of kind "card".
    let listed = documents::list(fx.pool(), &DocumentFilter::default())
        .await
        .unwrap();
    assert_eq!(listed[0].id, card.id);
    assert_eq!(listed[0].kind, DocumentKind::Card);

    let moved = set_type(fx.pool(), &card.id, &city).await.unwrap();
    assert_eq!(moved.type_id.as_deref(), Some(city.as_str()));

    let image = fx.image().await;
    let with_image = set_image(fx.pool(), &card.id, Some(&image)).await.unwrap();
    assert_eq!(with_image.image_asset_id.as_deref(), Some(image.as_str()));
    assert!(
        set_image(fx.pool(), &card.id, Some("missing.png"))
            .await
            .is_err()
    );

    let aliased = set_aliases(
        fx.pool(),
        &card.id,
        &[
            " Grands-Pas ".into(),
            "".into(),
            "grands-pas".into(),
            "Elessar".into(),
        ],
    )
    .await
    .unwrap();
    assert_eq!(aliased.aliases, ["Grands-Pas", "Elessar"]);
    assert_eq!(get(fx.pool(), &card.id).await.unwrap(), aliased);
}

#[tokio::test]
async fn list_separates_live_cards_from_the_trash() {
    let fx = Fixture::new().await;
    let character = fx.new_type("Personnage", None).await;
    let frodo = create(fx.pool(), &character, "Frodon").await.unwrap();
    create(fx.pool(), &character, "bilbon").await.unwrap();
    documents::trash(fx.pool(), &frodo.id).await.unwrap();

    let live: Vec<String> = list(fx.pool(), false)
        .await
        .unwrap()
        .into_iter()
        .map(|c| c.title)
        .collect();
    assert_eq!(live, ["bilbon"]);
    let trashed = list(fx.pool(), true).await.unwrap();
    assert_eq!(trashed.len(), 1);
    assert_eq!(trashed[0].id, frodo.id);
    assert_eq!(trashed[0].type_id.as_deref(), Some(character.as_str()));
}

#[tokio::test]
async fn recent_documents_and_counts_by_type() {
    let fx = Fixture::new().await;
    let character = fx.new_type("Personnage", None).await;
    let place = fx.new_type("Lieu", None).await;
    let frodo = create(fx.pool(), &character, "Frodon").await.unwrap();
    let sam = create(fx.pool(), &character, "Sam").await.unwrap();
    let shire = create(fx.pool(), &place, "La Comté").await.unwrap();
    let image = fx.image().await;
    set_image(fx.pool(), &shire.id, Some(&image)).await.unwrap();

    // Never opened: not recent.
    assert!(documents::recent(fx.pool(), 10).await.unwrap().is_empty());

    for card in [&frodo, &shire, &sam] {
        documents::mark_opened(fx.pool(), &card.id).await.unwrap();
        tokio::time::sleep(std::time::Duration::from_millis(5)).await;
    }
    documents::trash(fx.pool(), &sam.id).await.unwrap();

    let recent = documents::recent(fx.pool(), 10).await.unwrap();
    let titles: Vec<&str> = recent.iter().map(|d| d.title.as_str()).collect();
    assert_eq!(titles, ["La Comté", "Frodon"]);
    assert_eq!(recent[0].image_asset_id.as_deref(), Some(image.as_str()));
    assert_eq!(recent[0].type_id.as_deref(), Some(place.as_str()));
    assert_eq!(documents::recent(fx.pool(), 1).await.unwrap().len(), 1);
    assert!(documents::mark_opened(fx.pool(), "missing").await.is_err());

    let mut counts = count_by_type(fx.pool()).await.unwrap();
    counts.sort_by(|a, b| a.type_id.cmp(&b.type_id));
    let mut expected = vec![
        TypeCount {
            type_id: character.clone(),
            count: 1,
        },
        TypeCount {
            type_id: place.clone(),
            count: 1,
        },
    ];
    expected.sort_by(|a, b| a.type_id.cmp(&b.type_id));
    assert_eq!(counts, expected);
}

#[tokio::test]
async fn content_is_saved_with_its_plain_text() {
    let fx = Fixture::new().await;
    let character = fx.new_type("Personnage", None).await;
    let card = create(fx.pool(), &character, "Frodon").await.unwrap();
    assert_eq!(content(fx.pool(), &card.id).await.unwrap(), "[]");

    let json = r#"[{"id":"a","type":"text","doc":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Porteur de l'Anneau"}]}]}}]"#;
    set_content(fx.pool(), &card.id, json).await.unwrap();
    assert_eq!(content(fx.pool(), &card.id).await.unwrap(), json);
    let text: String = sqlx::query_scalar("SELECT content_text FROM cards WHERE document_id = ?")
        .bind(&card.id)
        .fetch_one(fx.pool())
        .await
        .unwrap();
    assert_eq!(text, "Porteur de l'Anneau");

    assert!(set_content(fx.pool(), &card.id, "[{}]").await.is_err());
    assert!(set_content(fx.pool(), "missing", "[]").await.is_err());
}

#[tokio::test]
async fn mentions_in_the_content_are_links_and_backlinks() {
    let fx = Fixture::new().await;
    let character = fx.new_type("Personnage", None).await;
    let frodo = create(fx.pool(), &character, "Frodon").await.unwrap();
    let sam = create(fx.pool(), &character, "Sam").await.unwrap();
    let gollum = create(fx.pool(), &character, "Gollum").await.unwrap();
    let with_mentions = |ids: &[&str]| {
        let nodes: Vec<serde_json::Value> = ids
            .iter()
            .map(|id| serde_json::json!({ "type": "mention", "attrs": { "id": id, "label": "x" } }))
            .collect();
        serde_json::json!([{ "id": "b", "type": "text", "doc": { "type": "doc", "content": [
            { "type": "paragraph", "content": nodes }
        ] } }])
        .to_string()
    };

    // Frodon mentions Sam, Gollum, and himself (no link to himself).
    set_content(
        fx.pool(),
        &frodo.id,
        &with_mentions(&[&sam.id, &gollum.id, &frodo.id]),
    )
    .await
    .unwrap();
    let cited_sam = links::backlinks(fx.pool(), &sam.id).await.unwrap();
    assert_eq!(cited_sam.len(), 1);
    assert_eq!(cited_sam[0].source_id, frodo.id);
    assert_eq!(cited_sam[0].via[0].kind, LinkKind::Mention);
    assert!(
        links::backlinks(fx.pool(), &frodo.id)
            .await
            .unwrap()
            .is_empty()
    );

    // The mention of Gollum is removed: so is its backlink.
    set_content(fx.pool(), &frodo.id, &with_mentions(&[&sam.id]))
        .await
        .unwrap();
    assert!(
        links::backlinks(fx.pool(), &gollum.id)
            .await
            .unwrap()
            .is_empty()
    );
    assert_eq!(links::backlinks(fx.pool(), &sam.id).await.unwrap().len(), 1);

    // A mention of a card deleted for good stays as a dead reference.
    documents::trash(fx.pool(), &sam.id).await.unwrap();
    documents::delete_forever(fx.pool(), &sam.id).await.unwrap();
    assert_eq!(links::to_target(fx.pool(), &sam.id).await.unwrap().len(), 1);
}

#[tokio::test]
async fn asset_usages_list_card_images_and_image_blocks() {
    let fx = Fixture::new().await;
    let character = fx.new_type("Personnage", None).await;
    let image = fx.image().await;
    let arwen = create(fx.pool(), &character, "Arwen").await.unwrap();
    let elrond = create(fx.pool(), &character, "Elrond").await.unwrap();
    let other = create(fx.pool(), &character, "Glorfindel").await.unwrap();
    set_image(fx.pool(), &arwen.id, Some(&image)).await.unwrap();
    let block =
        format!(r#"[{{"id":"b","type":"image","assetId":"{image}","caption":"Fondcombe"}}]"#);
    set_content(fx.pool(), &arwen.id, &block).await.unwrap();
    set_content(fx.pool(), &elrond.id, &block).await.unwrap();
    set_content(
        fx.pool(),
        &other.id,
        r#"[{"id":"t","type":"text","doc":{"type":"doc"}}]"#,
    )
    .await
    .unwrap();
    documents::trash(fx.pool(), &elrond.id).await.unwrap();

    let usages = media::card_usages(fx.pool(), &image).await.unwrap();
    assert_eq!(
        usages,
        vec![
            media::AssetUsage::CardImage {
                card_id: arwen.id.clone(),
                card_title: "Arwen".into(),
                in_trash: false,
            },
            media::AssetUsage::CardBlock {
                card_id: arwen.id.clone(),
                card_title: "Arwen".into(),
                in_trash: false,
            },
            media::AssetUsage::CardBlock {
                card_id: elrond.id.clone(),
                card_title: "Elrond".into(),
                in_trash: true,
            },
        ]
    );
    assert!(
        media::card_usages(fx.pool(), "unused.png")
            .await
            .unwrap()
            .is_empty()
    );
}

#[tokio::test]
async fn a_card_needs_an_existing_type() {
    let fx = Fixture::new().await;
    assert!(create(fx.pool(), "no-such-type", "Gandalf").await.is_err());
    let character = fx.new_type("Personnage", None).await;
    let card = create(fx.pool(), &character, "Gandalf").await.unwrap();
    assert!(set_type(fx.pool(), &card.id, "no-such-type").await.is_err());
}

#[tokio::test]
async fn too_many_aliases_are_refused() {
    let fx = Fixture::new().await;
    let character = fx.new_type("Personnage", None).await;
    let card = create(fx.pool(), &character, "Bilbon").await.unwrap();
    let many: Vec<String> = (0..=MAX_ALIASES).map(|i| format!("Alias {i}")).collect();
    assert!(set_aliases(fx.pool(), &card.id, &many).await.is_err());
}

#[tokio::test]
async fn deleting_a_type_moves_its_cards_and_its_subtypes_cards() {
    let fx = Fixture::new().await;
    let place = fx.new_type("Lieu", None).await;
    let city = fx.new_type("Ville", Some(&place)).await;
    let note = fx.new_type("Note", None).await;
    let rivendell = create(fx.pool(), &place, "Fondcombe").await.unwrap();
    let bree = create(fx.pool(), &city, "Bree").await.unwrap();

    assert_eq!(count_of_type(fx.pool(), &place).await.unwrap(), 2);
    // Cards need somewhere to go.
    assert!(card_types::delete(fx.pool(), &place, None).await.is_err());

    card_types::delete(fx.pool(), &place, Some(&note))
        .await
        .unwrap();
    for id in [&rivendell.id, &bree.id] {
        assert_eq!(
            get(fx.pool(), id).await.unwrap().type_id.as_deref(),
            Some(note.as_str())
        );
    }
    assert_eq!(count_of_type(fx.pool(), &note).await.unwrap(), 2);
}

#[tokio::test]
async fn deleting_an_image_removes_it_from_cards() {
    let fx = Fixture::new().await;
    let character = fx.new_type("Personnage", None).await;
    let card = create(fx.pool(), &character, "Arwen").await.unwrap();
    let image = fx.image().await;
    set_image(fx.pool(), &card.id, Some(&image)).await.unwrap();

    media::delete(fx.pool(), &fx.world.assets_dir(), &image)
        .await
        .unwrap();

    assert!(
        get(fx.pool(), &card.id)
            .await
            .unwrap()
            .image_asset_id
            .is_none()
    );
}

#[tokio::test]
async fn a_card_deleted_for_good_takes_its_data_with_it() {
    let fx = Fixture::new().await;
    let character = fx.new_type("Personnage", None).await;
    let card = create(fx.pool(), &character, "Boromir").await.unwrap();

    documents::trash(fx.pool(), &card.id).await.unwrap();
    assert!(get(fx.pool(), &card.id).await.unwrap().trashed_at.is_some());
    documents::delete_forever(fx.pool(), &card.id)
        .await
        .unwrap();

    assert!(get(fx.pool(), &card.id).await.is_err());
    assert_eq!(count_of_type(fx.pool(), &character).await.unwrap(), 0);
}

#[tokio::test]
async fn a_duplicate_copies_everything_but_the_name_and_sits_right_after() {
    use crate::domain::properties::{self, PropertyKind, PropertyOwner, PropertyValue};
    use crate::domain::tree::{self, Place};

    let fx = Fixture::new().await;
    let character = fx.new_type("Personnage", None).await;
    let shelf = tree::create_folder(fx.pool(), None, "Shelf", "folder")
        .await
        .unwrap();
    let aragorn = create(fx.pool(), &character, "Aragorn").await.unwrap();
    let boromir = create(fx.pool(), &character, "Boromir").await.unwrap();
    let gimli = create(fx.pool(), &character, "Gimli").await.unwrap();
    for (index, id) in [&aragorn.id, &gimli.id].into_iter().enumerate() {
        tree::move_document(
            fx.pool(),
            id,
            &Place::Folder {
                id: shelf.id.clone(),
            },
            index,
        )
        .await
        .unwrap();
    }
    let image = fx.image().await;
    set_image(fx.pool(), &aragorn.id, Some(&image))
        .await
        .unwrap();
    set_aliases(fx.pool(), &aragorn.id, &["Grands-Pas".to_owned()])
        .await
        .unwrap();
    let content =
        serde_json::json!([{ "id": "b", "type": "text", "doc": { "type": "doc", "content": [
        { "type": "paragraph", "content": [
            { "type": "mention", "attrs": { "id": boromir.id, "label": "Boromir" } },
            { "type": "mention", "attrs": { "id": aragorn.id, "label": "Aragorn" } }
        ] }
    ] } }])
        .to_string();
    set_content(fx.pool(), &aragorn.id, &content).await.unwrap();
    let age = properties::create(
        fx.pool(),
        PropertyOwner::Type {
            type_id: character.clone(),
        },
        "Âge",
        PropertyKind::Number,
    )
    .await
    .unwrap();
    // Created after the cards: shown on them too.
    properties::apply_to_existing(fx.pool(), &age.id)
        .await
        .unwrap();
    let friend = properties::create(
        fx.pool(),
        PropertyOwner::Card {
            card_id: aragorn.id.clone(),
        },
        "Ami",
        PropertyKind::Card,
    )
    .await
    .unwrap();
    properties::set_value(
        fx.pool(),
        &aragorn.id,
        &age.id,
        Some(PropertyValue::Number(87.0)),
    )
    .await
    .unwrap();
    properties::set_value(
        fx.pool(),
        &aragorn.id,
        &friend.id,
        Some(PropertyValue::Card(gimli.id.clone())),
    )
    .await
    .unwrap();
    tree::set_pinned(fx.pool(), &aragorn.id, true)
        .await
        .unwrap();

    let copy = duplicate(fx.pool(), &aragorn.id, "Aragorn (copie)")
        .await
        .unwrap();

    assert_eq!(copy.title, "Aragorn (copie)");
    assert_eq!(copy.type_id.as_deref(), Some(character.as_str()));
    assert_eq!(copy.image_asset_id.as_deref(), Some(image.as_str()));
    assert_eq!(copy.aliases, ["Grands-Pas"]);
    assert_eq!(super::content(fx.pool(), &copy.id).await.unwrap(), content);

    // Its own property is a new one, with the same label and value.
    let shown = properties::of_card(fx.pool(), &copy.id).await.unwrap();
    let value_of = |label: &str| {
        shown
            .iter()
            .find(|p| p.definition.label == label)
            .and_then(|p| p.value.clone())
    };
    assert_eq!(value_of("Âge"), Some(PropertyValue::Number(87.0)));
    assert_eq!(value_of("Ami"), Some(PropertyValue::Card(gimli.id.clone())));
    let own = shown.iter().find(|p| p.definition.label == "Ami").unwrap();
    assert_ne!(own.definition.id, friend.id);
    // Removing the original's property leaves the copy's.
    properties::delete(fx.pool(), &friend.id).await.unwrap();
    assert!(
        properties::of_card(fx.pool(), &copy.id)
            .await
            .unwrap()
            .iter()
            .any(|p| p.definition.label == "Ami")
    );

    // Links: Boromir is cited by both, Aragorn by its copy.
    async fn cites(pool: &SqlitePool, id: &str) -> Vec<String> {
        let mut sources: Vec<String> = links::backlinks(pool, id)
            .await
            .unwrap()
            .into_iter()
            .map(|b| b.source_title)
            .collect();
        sources.sort();
        sources
    }
    assert_eq!(
        cites(fx.pool(), &boromir.id).await,
        ["Aragorn", "Aragorn (copie)"]
    );
    // The original lost its "Ami" property above; the copy kept its own.
    assert_eq!(cites(fx.pool(), &gimli.id).await, ["Aragorn (copie)"]);
    assert_eq!(cites(fx.pool(), &aragorn.id).await, ["Aragorn (copie)"]);

    // Right after the original, in its folder; not pinned.
    let tree = tree::tree(fx.pool()).await.unwrap();
    let mut in_shelf: Vec<_> = tree
        .documents
        .iter()
        .filter(|d| d.folder_id.as_deref() == Some(shelf.id.as_str()))
        .collect();
    in_shelf.sort_by_key(|d| d.sort_order);
    let titles: Vec<&str> = in_shelf.iter().map(|d| d.title.as_str()).collect();
    assert_eq!(titles, ["Aragorn", "Aragorn (copie)", "Gimli"]);
    let orders: Vec<i32> = in_shelf.iter().map(|d| d.sort_order).collect();
    assert_eq!(orders, [0, 1, 2]);
    let copy_row = tree.documents.iter().find(|d| d.id == copy.id).unwrap();
    assert_eq!(copy_row.pinned_order, None);
}
