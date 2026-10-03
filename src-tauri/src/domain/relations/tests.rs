use super::*;
use crate::db;
use crate::domain::card_types::{self, NewCardType};
use crate::domain::properties::{self, PropertyKind, PropertyOwner, PropertyValue};
use crate::domain::trees::{EdgeSource, LineStyle, TreeEdge, TreeNode, VariantContent};
use crate::domain::{cards, documents};
use crate::world;

fn relation(from: &str, to: &str, kind: Option<&str>) -> KnownRelation {
    KnownRelation {
        from: from.into(),
        to: to.into(),
        relation_type_id: kind.map(Into::into),
    }
}

#[test]
fn a_relation_is_said_one_way() {
    let inverses: HashMap<String, String> = [
        ("rel-parent", "rel-child"),
        ("rel-child", "rel-parent"),
        ("rel-spouse", "rel-spouse"),
    ]
    .into_iter()
    .map(|(a, b)| (a.to_owned(), b.to_owned()))
    .collect();
    // « Arathorn : parent de Aragorn » is « Aragorn : enfant de Arathorn ».
    assert_eq!(
        canonical(
            relation("aragorn", "arathorn", Some("rel-parent")),
            &inverses
        ),
        relation("arathorn", "aragorn", Some("rel-child"))
    );
    assert_eq!(
        canonical(
            relation("arathorn", "aragorn", Some("rel-child")),
            &inverses
        ),
        relation("arathorn", "aragorn", Some("rel-child"))
    );
    // A symmetric relation: its cards in order.
    assert_eq!(
        canonical(
            relation("gilraen", "arathorn", Some("rel-spouse")),
            &inverses
        ),
        relation("arathorn", "gilraen", Some("rel-spouse"))
    );
    // No type, or a type without inverse: as it is.
    assert_eq!(
        canonical(relation("b", "a", None), &inverses),
        relation("b", "a", None)
    );
    assert_eq!(
        canonical(relation("b", "a", Some("rel-mentor")), &inverses),
        relation("b", "a", Some("rel-mentor"))
    );
}

#[tokio::test]
async fn the_known_relations_come_from_the_trees_and_the_relation_properties_once() {
    let dir = tempfile::tempdir().unwrap();
    let world = world::create(&dir.path().join("W"), "W", &db::MIGRATOR)
        .await
        .unwrap();
    let pool = &world.pool;
    let character = card_types::create(
        pool,
        NewCardType {
            parent_id: None,
            name: "Personnage".into(),
            icon: "user".into(),
            color: "blue".into(),
        },
    )
    .await
    .unwrap()
    .id;
    let parents = properties::create(
        pool,
        PropertyOwner::Type {
            type_id: character.clone(),
        },
        "Parents",
        PropertyKind::Text,
    )
    .await
    .unwrap();
    properties::set_kind(pool, &parents.id, PropertyKind::Cards, &[])
        .await
        .unwrap();
    properties::set_relation(pool, &parents.id, Some("rel-parent"))
        .await
        .unwrap();
    let card = |title: &'static str| {
        let character = character.clone();
        async move { cards::create(pool, &character, title).await.unwrap().id }
    };
    let arathorn = card("Arathorn").await;
    let gilraen = card("Gilraen").await;
    let aragorn = card("Aragorn").await;
    let gollum = card("Gollum").await;

    // The property: Aragorn's parents are Arathorn and Gilraen (and Gollum,
    // who will go to the trash).
    properties::set_value(
        pool,
        &aragorn,
        &parents.id,
        Some(PropertyValue::Cards(vec![
            arathorn.clone(),
            gilraen.clone(),
            gollum.clone(),
        ])),
    )
    .await
    .unwrap();
    documents::trash(pool, &gollum).await.unwrap();
    // A tree says the same about Arathorn, and that he married Gilraen.
    let tree = trees::create(pool, "Maison d'Isildur", "Principale")
        .await
        .unwrap();
    let node = |id: &str, card: &str| TreeNode {
        id: id.into(),
        card_id: Some(card.into()),
        label: String::new(),
        x: 0.0,
        y: 0.0,
    };
    let edge = |id: &str, from: &str, to: &str, kind: &str| TreeEdge {
        id: id.into(),
        source: EdgeSource::Node(from.into()),
        target: to.into(),
        relation_type_id: Some(kind.into()),
        line_style: LineStyle::Solid,
    };
    let content = VariantContent {
        nodes: vec![
            node("n-arathorn", &arathorn),
            node("n-gilraen", &gilraen),
            node("n-aragorn", &aragorn),
        ],
        edges: vec![
            edge("e1", "n-arathorn", "n-aragorn", "rel-child"),
            edge("e2", "n-gilraen", "n-arathorn", "rel-spouse"),
        ],
        annotations: vec![],
    };
    trees::save_variant(pool, &tree.variants[0].id, &content)
        .await
        .unwrap();

    let known = known(pool).await.unwrap();

    let married = if arathorn <= gilraen {
        relation(&arathorn, &gilraen, Some("rel-spouse"))
    } else {
        relation(&gilraen, &arathorn, Some("rel-spouse"))
    };
    assert_eq!(
        known,
        [
            relation(&arathorn, &aragorn, Some("rel-child")),
            married,
            relation(&gilraen, &aragorn, Some("rel-child")),
        ]
    );
}
