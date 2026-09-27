//! Property tests, on a real world (real migrations) in a temp folder.

use super::*;
use crate::db;
use crate::domain::card_types::NewCardType;
use crate::domain::documents;
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

    async fn card(&self, type_id: &str, title: &str) -> String {
        cards::create(self.pool(), type_id, title).await.unwrap().id
    }
}

fn on_type(type_id: &str) -> PropertyOwner {
    PropertyOwner::Type {
        type_id: type_id.into(),
    }
}

fn labels(properties: &[CardProperty]) -> Vec<&str> {
    properties
        .iter()
        .map(|p| p.definition.label.as_str())
        .collect()
}

/// Card creation dates are compared to property dates: let the clock move.
async fn tick() {
    tokio::time::sleep(std::time::Duration::from_millis(5)).await;
}

#[tokio::test]
async fn a_type_property_shows_on_new_cards_then_on_existing_ones_once_applied() {
    let fx = Fixture::new().await;
    let character = fx.new_type("Personnage", None).await;
    let old = fx.card(&character, "Ancien").await;
    tick().await;
    let age = create(
        fx.pool(),
        on_type(&character),
        " Âge ",
        PropertyKind::Number,
    )
    .await
    .unwrap();
    assert_eq!(age.label, "Âge");
    assert!(!age.applies_to_existing);
    tick().await;
    let new = fx.card(&character, "Nouveau").await;

    // Created after the property: shows it. Created before: not yet.
    assert_eq!(labels(&of_card(fx.pool(), &new).await.unwrap()), ["Âge"]);
    assert!(of_card(fx.pool(), &old).await.unwrap().is_empty());

    // "Apply the changes to all the cards of this type?" Yes.
    apply_to_existing(fx.pool(), &age.id).await.unwrap();
    assert_eq!(labels(&of_card(fx.pool(), &old).await.unwrap()), ["Âge"]);
}

#[tokio::test]
async fn subtypes_inherit_their_type_properties_and_cards_have_their_own() {
    let fx = Fixture::new().await;
    let place = fx.new_type("Lieu", None).await;
    let city = fx.new_type("Ville", Some(&place)).await;
    let population = create(
        fx.pool(),
        on_type(&place),
        "Population",
        PropertyKind::Number,
    )
    .await
    .unwrap();
    create(fx.pool(), on_type(&city), "Maire", PropertyKind::Text)
        .await
        .unwrap();
    apply_to_existing(fx.pool(), &population.id).await.unwrap();
    tick().await;
    let bree = fx.card(&city, "Bree").await;
    create(
        fx.pool(),
        PropertyOwner::Card {
            card_id: bree.clone(),
        },
        "Auberge",
        PropertyKind::Text,
    )
    .await
    .unwrap();

    assert_eq!(
        labels(&of_card(fx.pool(), &bree).await.unwrap()),
        ["Population", "Maire", "Auberge"]
    );
    // The type only lists its own properties.
    assert_eq!(of_type(fx.pool(), &city).await.unwrap().len(), 1);
}

#[tokio::test]
async fn values_are_typed_saved_and_cleared() {
    let fx = Fixture::new().await;
    let character = fx.new_type("Personnage", None).await;
    let age = create(fx.pool(), on_type(&character), "Âge", PropertyKind::Number)
        .await
        .unwrap();
    let title = create(fx.pool(), on_type(&character), "Titre", PropertyKind::Text)
        .await
        .unwrap();
    tick().await;
    let aragorn = fx.card(&character, "Aragorn").await;

    let shown = set_value(
        fx.pool(),
        &aragorn,
        &age.id,
        Some(PropertyValue::Number(87.0)),
    )
    .await
    .unwrap();
    assert_eq!(shown[0].value, Some(PropertyValue::Number(87.0)));

    // Wrong kind, not finite, or a property the card does not show: refused.
    assert!(
        set_value(
            fx.pool(),
            &aragorn,
            &age.id,
            Some(PropertyValue::Text("x".into()))
        )
        .await
        .is_err()
    );
    assert!(
        set_value(
            fx.pool(),
            &aragorn,
            &age.id,
            Some(PropertyValue::Number(f64::NAN))
        )
        .await
        .is_err()
    );
    assert!(set_value(fx.pool(), &aragorn, "other", None).await.is_err());

    // An empty text is no value.
    let shown = set_value(
        fx.pool(),
        &aragorn,
        &title.id,
        Some(PropertyValue::Text("  ".into())),
    )
    .await
    .unwrap();
    assert_eq!(shown[1].value, None);

    assert_eq!(count_values(fx.pool(), &age.id).await.unwrap(), 1);
    let shown = set_value(fx.pool(), &aragorn, &age.id, None).await.unwrap();
    assert_eq!(shown[0].value, None);
    assert_eq!(count_values(fx.pool(), &age.id).await.unwrap(), 0);
}

#[tokio::test]
async fn renaming_reordering_and_deleting() {
    let fx = Fixture::new().await;
    let character = fx.new_type("Personnage", None).await;
    let a = create(fx.pool(), on_type(&character), "A", PropertyKind::Text)
        .await
        .unwrap();
    let b = create(fx.pool(), on_type(&character), "B", PropertyKind::Text)
        .await
        .unwrap();
    tick().await;
    let card = fx.card(&character, "Gimli").await;
    set_value(
        fx.pool(),
        &card,
        &a.id,
        Some(PropertyValue::Text("valeur".into())),
    )
    .await
    .unwrap();

    rename(fx.pool(), &a.id, "Surnom").await.unwrap();
    reorder(fx.pool(), &[b.id.clone(), a.id.clone()])
        .await
        .unwrap();
    assert_eq!(
        labels(&of_card(fx.pool(), &card).await.unwrap()),
        ["B", "Surnom"]
    );
    assert!(
        reorder(fx.pool(), std::slice::from_ref(&a.id))
            .await
            .is_err()
    );
    assert!(rename(fx.pool(), &a.id, " ").await.is_err());

    delete(fx.pool(), &a.id).await.unwrap();
    assert_eq!(labels(&of_card(fx.pool(), &card).await.unwrap()), ["B"]);
}

#[tokio::test]
async fn link_values_are_links_to_allowed_live_cards() {
    let fx = Fixture::new().await;
    let character = fx.new_type("Personnage", None).await;
    let place = fx.new_type("Lieu", None).await;
    let city = fx.new_type("Ville", Some(&place)).await;
    let birthplace = create(
        fx.pool(),
        on_type(&character),
        "Lieu de naissance",
        PropertyKind::Text,
    )
    .await
    .unwrap();
    let birthplace = set_kind(
        fx.pool(),
        &birthplace.id,
        PropertyKind::Card,
        std::slice::from_ref(&place),
    )
    .await
    .unwrap();
    assert_eq!(
        birthplace.target_type_ids.as_slice(),
        std::slice::from_ref(&place)
    );
    tick().await;
    let aragorn = fx.card(&character, "Aragorn").await;
    let minas = fx.card(&city, "Minas Tirith").await;
    let gandalf = fx.card(&character, "Gandalf").await;

    // A city is a place: allowed. A character is not.
    set_value(
        fx.pool(),
        &aragorn,
        &birthplace.id,
        Some(PropertyValue::Card(minas.clone())),
    )
    .await
    .unwrap();
    assert!(
        set_value(
            fx.pool(),
            &aragorn,
            &birthplace.id,
            Some(PropertyValue::Card(gandalf.clone()))
        )
        .await
        .is_err()
    );

    let to_minas = links::to_target(fx.pool(), &minas).await.unwrap();
    assert_eq!(to_minas.len(), 1);
    assert_eq!(to_minas[0].source_id, aragorn);
    assert_eq!(to_minas[0].kind, LinkKind::Property);

    // A card in the trash cannot be chosen.
    documents::trash(fx.pool(), &gandalf).await.unwrap();
    let anywhere = create(fx.pool(), on_type(&character), "Ami", PropertyKind::Card)
        .await
        .unwrap();
    apply_to_existing(fx.pool(), &anywhere.id).await.unwrap();
    assert!(
        set_value(
            fx.pool(),
            &aragorn,
            &anywhere.id,
            Some(PropertyValue::Card(gandalf))
        )
        .await
        .is_err()
    );

    // Changing the kind drops the values and their links.
    set_kind(fx.pool(), &birthplace.id, PropertyKind::Text, &[])
        .await
        .unwrap();
    assert!(
        links::to_target(fx.pool(), &minas)
            .await
            .unwrap()
            .is_empty()
    );
    assert_eq!(count_values(fx.pool(), &birthplace.id).await.unwrap(), 0);
}
