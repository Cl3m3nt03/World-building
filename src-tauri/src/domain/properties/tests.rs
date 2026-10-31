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
async fn a_card_orders_its_own_properties_and_never_those_of_its_type() {
    let fx = Fixture::new().await;
    let place = fx.new_type("Lieu", None).await;
    let city = fx.new_type("Ville", Some(&place)).await;
    let add = |owner: PropertyOwner, label: &'static str| {
        let pool = fx.pool().clone();
        async move {
            create(&pool, owner, label, PropertyKind::Text)
                .await
                .unwrap()
        }
    };
    let area = add(on_type(&place), "Superficie").await;
    let climate = add(on_type(&place), "Climat").await;
    let mayor = add(on_type(&city), "Maire").await;
    let walls = add(on_type(&city), "Remparts").await;
    tick().await;
    let bree = fx.card(&city, "Bree").await;
    let on_bree = || PropertyOwner::Card {
        card_id: bree.clone(),
    };
    let inn = add(on_bree(), "Auberge").await;
    let gate = add(on_bree(), "Porte").await;

    reorder(fx.pool(), &[gate.id.clone(), inn.id.clone()])
        .await
        .unwrap();
    assert_eq!(
        labels(&of_card(fx.pool(), &bree).await.unwrap()),
        [
            "Superficie",
            "Climat",
            "Maire",
            "Remparts",
            "Porte",
            "Auberge"
        ],
        "the card's own order changed, not its type's"
    );

    // A subtype orders its own properties; the parent's still come first.
    reorder(fx.pool(), &[walls.id.clone(), mayor.id.clone()])
        .await
        .unwrap();
    let shown = [
        "Superficie",
        "Climat",
        "Remparts",
        "Maire",
        "Porte",
        "Auberge",
    ];
    assert_eq!(labels(&of_card(fx.pool(), &bree).await.unwrap()), shown);

    // What a card shows cannot be sent as one list: nothing moves.
    for mixed in [
        vec![gate.id.clone(), inn.id.clone(), mayor.id.clone()],
        vec![climate.id.clone(), area.id.clone(), gate.id.clone()],
        vec![
            mayor.id.clone(),
            walls.id.clone(),
            gate.id.clone(),
            inn.id.clone(),
        ],
    ] {
        assert!(reorder(fx.pool(), &mixed).await.is_err());
    }
    assert_eq!(labels(&of_card(fx.pool(), &bree).await.unwrap()), shown);
}

#[tokio::test]
async fn backlinks_list_each_citing_card_once_with_its_properties() {
    let fx = Fixture::new().await;
    let character = fx.new_type("Personnage", None).await;
    let place = fx.new_type("Lieu", None).await;
    let born = create(
        fx.pool(),
        on_type(&character),
        "Lieu de naissance",
        PropertyKind::Card,
    )
    .await
    .unwrap();
    let lives = create(
        fx.pool(),
        on_type(&character),
        "Demeures",
        PropertyKind::Cards,
    )
    .await
    .unwrap();
    tick().await;
    let gondor = fx.card(&place, "Gondor").await;
    let aragorn = fx.card(&character, "Aragorn").await;
    let boromir = fx.card(&character, "Boromir").await;

    set_value(
        fx.pool(),
        &aragorn,
        &born.id,
        Some(PropertyValue::Card(gondor.clone())),
    )
    .await
    .unwrap();
    set_value(
        fx.pool(),
        &aragorn,
        &lives.id,
        Some(PropertyValue::Cards(vec![gondor.clone()])),
    )
    .await
    .unwrap();
    set_value(
        fx.pool(),
        &boromir,
        &born.id,
        Some(PropertyValue::Card(gondor.clone())),
    )
    .await
    .unwrap();

    let backlinks = links::backlinks(fx.pool(), &gondor).await.unwrap();
    let titles: Vec<&str> = backlinks.iter().map(|b| b.source_title.as_str()).collect();
    assert_eq!(titles, ["Aragorn", "Boromir"]);
    let aragorn_via: Vec<Option<&str>> = backlinks[0]
        .via
        .iter()
        .map(|via| via.property_label.as_deref())
        .collect();
    assert_eq!(aragorn_via, [Some("Demeures"), Some("Lieu de naissance")]);
    assert_eq!(
        backlinks[0].source_type_id.as_deref(),
        Some(character.as_str())
    );

    // A citing card in the trash is left out; back from the trash, it returns.
    documents::trash(fx.pool(), &boromir).await.unwrap();
    assert_eq!(links::backlinks(fx.pool(), &gondor).await.unwrap().len(), 1);
    documents::restore(fx.pool(), &boromir).await.unwrap();
    assert_eq!(links::backlinks(fx.pool(), &gondor).await.unwrap().len(), 2);

    // Clearing the value removes the backlink.
    set_value(fx.pool(), &boromir, &born.id, None)
        .await
        .unwrap();
    assert_eq!(links::backlinks(fx.pool(), &gondor).await.unwrap().len(), 1);
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

#[tokio::test]
async fn a_link_property_can_be_a_relation_of_the_world() {
    let fx = Fixture::new().await;
    let character = fx.new_type("Personnage", None).await;
    let parents = create(
        fx.pool(),
        on_type(&character),
        "Parents",
        PropertyKind::Text,
    )
    .await
    .unwrap();
    // A text is no relation.
    assert!(
        set_relation(fx.pool(), &parents.id, Some("rel-parent"))
            .await
            .is_err()
    );
    let parents = set_kind(fx.pool(), &parents.id, PropertyKind::Cards, &[])
        .await
        .unwrap();
    assert!(
        set_relation(fx.pool(), &parents.id, Some("rel-unknown"))
            .await
            .is_err()
    );
    let parents = set_relation(fx.pool(), &parents.id, Some("rel-parent"))
        .await
        .unwrap();
    assert_eq!(parents.relation_type_id.as_deref(), Some("rel-parent"));
    assert_eq!(
        get(fx.pool(), &parents.id)
            .await
            .unwrap()
            .relation_type_id
            .as_deref(),
        Some("rel-parent")
    );

    // Its values tell the graph which relation links the cards.
    tick().await;
    let aragorn = fx.card(&character, "Aragorn").await;
    let arathorn = fx.card(&character, "Arathorn").await;
    set_value(
        fx.pool(),
        &aragorn,
        &parents.id,
        Some(PropertyValue::Cards(vec![arathorn.clone()])),
    )
    .await
    .unwrap();
    let data = crate::domain::graphs::data(fx.pool()).await.unwrap();
    assert_eq!(
        data.edges[0].reasons,
        [crate::domain::graphs::EdgeReason::Property {
            from: aragorn.clone(),
            label: "Parents".into(),
            relation_type_id: Some("rel-parent".into()),
        }]
    );

    // No longer a link: no longer a relation.
    let parents = set_kind(fx.pool(), &parents.id, PropertyKind::Text, &[])
        .await
        .unwrap();
    assert_eq!(parents.relation_type_id, None);
    // Back to a link: just a link, until told otherwise.
    let parents = set_kind(fx.pool(), &parents.id, PropertyKind::Card, &[])
        .await
        .unwrap();
    assert_eq!(parents.relation_type_id, None);
    let parents = set_relation(fx.pool(), &parents.id, None).await.unwrap();
    assert_eq!(parents.relation_type_id, None);
}

#[tokio::test]
async fn a_relation_deleted_leaves_its_properties_plain_links() {
    let fx = Fixture::new().await;
    let character = fx.new_type("Personnage", None).await;
    let custom = crate::domain::trees::create_relation_type(
        fx.pool(),
        &crate::domain::trees::RelationTypeInput {
            name: "Mentor".into(),
            icon: "graduation-cap".into(),
            category: crate::domain::trees::RelationCategory::Custom,
            inverse_id: None,
            symmetric: false,
        },
    )
    .await
    .unwrap();
    let mentor = create(fx.pool(), on_type(&character), "Mentor", PropertyKind::Text)
        .await
        .unwrap();
    set_kind(fx.pool(), &mentor.id, PropertyKind::Card, &[])
        .await
        .unwrap();
    set_relation(fx.pool(), &mentor.id, Some(&custom.id))
        .await
        .unwrap();
    crate::domain::trees::delete_relation_type(fx.pool(), &custom.id)
        .await
        .unwrap();
    assert_eq!(
        get(fx.pool(), &mentor.id).await.unwrap().relation_type_id,
        None
    );
}

// --- Select and date (ADR 0014) ---------------------------------------------

fn new_option(label: &str) -> PropertyOptionInput {
    PropertyOptionInput {
        id: None,
        label: label.into(),
    }
}

fn kept(option: &PropertyOption) -> PropertyOptionInput {
    PropertyOptionInput {
        id: Some(option.id.clone()),
        label: option.label.clone(),
    }
}

/// A card, and a select property of its type offering the given choices.
async fn select_fixture(fx: &Fixture, labels: &[&str]) -> (String, PropertyDefinition) {
    let character = fx.new_type("Personnage", None).await;
    let status = create(
        fx.pool(),
        on_type(&character),
        "Statut",
        PropertyKind::Select,
    )
    .await
    .unwrap();
    tick().await;
    let card = fx.card(&character, "Aragorn").await;
    let options: Vec<_> = labels.iter().map(|label| new_option(label)).collect();
    let status = set_options(fx.pool(), &status.id, &options, false)
        .await
        .unwrap();
    (card, status)
}

fn value_of(properties: &[CardProperty], id: &str) -> Option<PropertyValue> {
    properties
        .iter()
        .find(|property| property.definition.id == id)
        .and_then(|property| property.value.clone())
}

fn select(ids: &[&String]) -> PropertyValue {
    PropertyValue::Select(ids.iter().map(|id| (*id).clone()).collect())
}

#[tokio::test]
async fn a_renamed_choice_keeps_the_values_and_its_id() {
    let fx = Fixture::new().await;
    let (card, status) = select_fixture(&fx, &["Vivant", "Mort"]).await;
    let alive = status.options[0].id.clone();
    set_value(fx.pool(), &card, &status.id, Some(select(&[&alive])))
        .await
        .unwrap();

    let renamed = set_options(
        fx.pool(),
        &status.id,
        &[
            PropertyOptionInput {
                id: Some(alive.clone()),
                label: " En vie ".into(),
            },
            kept(&status.options[1]),
        ],
        false,
    )
    .await
    .unwrap();
    assert_eq!(renamed.options[0].id, alive);
    assert_eq!(renamed.options[0].label, "En vie");
    assert_eq!(
        value_of(&of_card(fx.pool(), &card).await.unwrap(), &status.id),
        Some(select(&[&alive]))
    );
}

#[tokio::test]
async fn removing_a_choice_takes_it_off_the_cards_and_says_how_many_had_it() {
    let fx = Fixture::new().await;
    let (card, status) = select_fixture(&fx, &["Vivant", "Mort", "Disparu"]).await;
    let [alive, dead, gone] = [
        status.options[0].clone(),
        status.options[1].clone(),
        status.options[2].clone(),
    ];
    let status = set_options(
        fx.pool(),
        &status.id,
        &[kept(&alive), kept(&dead), kept(&gone)],
        true,
    )
    .await
    .unwrap();
    set_value(
        fx.pool(),
        &card,
        &status.id,
        Some(select(&[&alive.id, &gone.id])),
    )
    .await
    .unwrap();
    assert_eq!(
        count_option_values(fx.pool(), &status.id, &gone.id)
            .await
            .unwrap(),
        1
    );
    assert_eq!(
        count_option_values(fx.pool(), &status.id, &dead.id)
            .await
            .unwrap(),
        0
    );

    // The card keeps its other choice…
    set_options(fx.pool(), &status.id, &[kept(&alive), kept(&dead)], true)
        .await
        .unwrap();
    assert_eq!(
        value_of(&of_card(fx.pool(), &card).await.unwrap(), &status.id),
        Some(select(&[&alive.id]))
    );
    // … and a card left without one has no value.
    set_options(fx.pool(), &status.id, &[kept(&dead)], true)
        .await
        .unwrap();
    assert_eq!(
        value_of(&of_card(fx.pool(), &card).await.unwrap(), &status.id),
        None
    );
    assert_eq!(count_values(fx.pool(), &status.id).await.unwrap(), 0);
}

#[tokio::test]
async fn a_single_choice_property_holds_one_choice() {
    let fx = Fixture::new().await;
    let (card, status) = select_fixture(&fx, &["Vivant", "Mort"]).await;
    let (alive, dead) = (&status.options[0], &status.options[1]);

    let refused = set_value(
        fx.pool(),
        &card,
        &status.id,
        Some(select(&[&alive.id, &dead.id])),
    )
    .await;
    assert!(matches!(refused, Err(AppError::InvalidInput(_))));

    let unknown = "not-a-choice".to_owned();
    let refused = set_value(fx.pool(), &card, &status.id, Some(select(&[&unknown]))).await;
    assert!(matches!(refused, Err(AppError::InvalidInput(_))));

    // A choice listed twice is one choice.
    let shown = set_value(
        fx.pool(),
        &card,
        &status.id,
        Some(select(&[&alive.id, &alive.id])),
    )
    .await
    .unwrap();
    assert_eq!(value_of(&shown, &status.id), Some(select(&[&alive.id])));

    // No choice left is no value.
    let shown = set_value(fx.pool(), &card, &status.id, Some(select(&[])))
        .await
        .unwrap();
    assert_eq!(value_of(&shown, &status.id), None);
}

#[tokio::test]
async fn going_back_to_a_single_choice_keeps_what_cards_hold() {
    let fx = Fixture::new().await;
    let (card, status) = select_fixture(&fx, &["A", "B", "C", "D"]).await;
    let options = status.options.clone();
    let all: Vec<_> = options.iter().map(kept).collect();
    set_options(fx.pool(), &status.id, &all, true)
        .await
        .unwrap();
    let three = select(&[&options[0].id, &options[1].id, &options[2].id]);
    set_value(fx.pool(), &card, &status.id, Some(three.clone()))
        .await
        .unwrap();

    set_options(fx.pool(), &status.id, &all, false)
        .await
        .unwrap();
    let shown = of_card(fx.pool(), &card).await.unwrap();
    assert_eq!(value_of(&shown, &status.id), Some(three));

    // It can lose some, gain none, or be replaced.
    let two = select(&[&options[0].id, &options[1].id]);
    set_value(fx.pool(), &card, &status.id, Some(two))
        .await
        .unwrap();
    let more = select(&[&options[0].id, &options[3].id]);
    assert!(
        set_value(fx.pool(), &card, &status.id, Some(more))
            .await
            .is_err()
    );
    let other = select(&[&options[3].id]);
    let shown = set_value(fx.pool(), &card, &status.id, Some(other.clone()))
        .await
        .unwrap();
    assert_eq!(value_of(&shown, &status.id), Some(other));
}

#[tokio::test]
async fn choices_are_checked() {
    let fx = Fixture::new().await;
    let (_, status) = select_fixture(&fx, &["Vivant"]).await;

    let empty = set_options(fx.pool(), &status.id, &[new_option("  ")], false).await;
    assert!(matches!(empty, Err(AppError::InvalidInput(_))));

    let long = new_option(&"x".repeat(MAX_OPTION_LEN + 1));
    let too_long = set_options(fx.pool(), &status.id, &[long], false).await;
    assert!(matches!(too_long, Err(AppError::InvalidInput(_))));

    let many: Vec<_> = (0..=MAX_OPTIONS)
        .map(|index| new_option(&index.to_string()))
        .collect();
    let too_many = set_options(fx.pool(), &status.id, &many, false).await;
    assert!(matches!(too_many, Err(AppError::InvalidInput(_))));

    let invented = PropertyOptionInput {
        id: Some("invented".into()),
        label: "Inventé".into(),
    };
    let unknown = set_options(fx.pool(), &status.id, &[invented], false).await;
    assert!(matches!(unknown, Err(AppError::InvalidInput(_))));

    let twice = kept(&status.options[0]);
    let repeated = set_options(fx.pool(), &status.id, &[twice.clone(), twice], false).await;
    assert!(matches!(repeated, Err(AppError::InvalidInput(_))));

    // Only a select has choices.
    let character = fx.new_type("Autre", None).await;
    let text = create(fx.pool(), on_type(&character), "Titre", PropertyKind::Text)
        .await
        .unwrap();
    let not_select = set_options(fx.pool(), &text.id, &[new_option("A")], false).await;
    assert!(matches!(not_select, Err(AppError::InvalidInput(_))));
}

#[tokio::test]
async fn leaving_the_select_kind_drops_its_values_and_its_choices() {
    let fx = Fixture::new().await;
    let (card, status) = select_fixture(&fx, &["Vivant"]).await;
    let chosen = status.options[0].id.clone();
    set_value(fx.pool(), &card, &status.id, Some(select(&[&chosen])))
        .await
        .unwrap();

    let same = set_kind(fx.pool(), &status.id, PropertyKind::Select, &[])
        .await
        .unwrap();
    assert_eq!(same.options.len(), 1);
    assert_eq!(count_values(fx.pool(), &status.id).await.unwrap(), 1);

    let text = set_kind(fx.pool(), &status.id, PropertyKind::Text, &[])
        .await
        .unwrap();
    assert!(text.options.is_empty());
    assert!(!text.multiple);
    assert_eq!(count_values(fx.pool(), &status.id).await.unwrap(), 0);
}

#[tokio::test]
async fn a_date_keeps_its_days_and_its_precision() {
    let fx = Fixture::new().await;
    let character = fx.new_type("Personnage", None).await;
    let birth = create(
        fx.pool(),
        on_type(&character),
        "Naissance",
        PropertyKind::Date,
    )
    .await
    .unwrap();
    tick().await;
    let card = fx.card(&character, "Aragorn").await;
    let date = PropertyValue::Date(PropertyDate {
        days: -1234,
        precision: DatePrecision::Month,
    });
    let shown = set_value(fx.pool(), &card, &birth.id, Some(date.clone()))
        .await
        .unwrap();
    assert_eq!(value_of(&shown, &birth.id), Some(date));

    let wrong = set_value(
        fx.pool(),
        &card,
        &birth.id,
        Some(PropertyValue::Text("hier".into())),
    )
    .await;
    assert!(matches!(wrong, Err(AppError::InvalidInput(_))));

    let cleared = set_value(fx.pool(), &card, &birth.id, None).await.unwrap();
    assert_eq!(value_of(&cleared, &birth.id), None);
}

#[tokio::test]
async fn an_unreadable_value_never_keeps_a_card_from_opening() {
    let fx = Fixture::new().await;
    let (card, status) = select_fixture(&fx, &["Vivant"]).await;
    let character = cards::get(fx.pool(), &card).await.unwrap().type_id.unwrap();
    let birth = create(
        fx.pool(),
        on_type(&character),
        "Naissance",
        PropertyKind::Date,
    )
    .await
    .unwrap();
    apply_to_existing(fx.pool(), &birth.id).await.unwrap();

    let alive = status.options[0].id.clone();
    let partly_known = format!(r#"{{"kind":"select","value":["gone","{alive}"]}}"#);
    let cases: [(&String, &str, Option<PropertyValue>); 8] = [
        (&status.id, "not json", None),
        (&status.id, r#"{"kind":"select","value":"x"}"#, None),
        (&status.id, r#"{"kind":"select","value":["gone"]}"#, None),
        (&status.id, r#"{"kind":"text","value":"Vivant"}"#, None),
        (&status.id, &partly_known, Some(select(&[&alive]))),
        (&birth.id, r#"{"kind":"date","value":{"days":"x"}}"#, None),
        (&birth.id, r#"{"kind":"date","value":12}"#, None),
        (
            &birth.id,
            r#"{"kind":"date","value":{"days":1,"precision":"century"}}"#,
            None,
        ),
    ];
    for (property, json, expected) in cases {
        queries::set_value(fx.pool(), &card, property, json)
            .await
            .unwrap();
        let shown = of_card(fx.pool(), &card).await.unwrap();
        assert_eq!(value_of(&shown, property), expected, "{json}");
    }

    // Unreadable choices read as none.
    sqlx::query("UPDATE property_definitions SET options = 'not json' WHERE id = ?")
        .bind(&status.id)
        .execute(fx.pool())
        .await
        .unwrap();
    let shown = of_card(fx.pool(), &card).await.unwrap();
    assert!(
        shown
            .iter()
            .find(|property| property.definition.id == status.id)
            .is_some_and(|property| property.definition.options.is_empty())
    );
}

#[tokio::test]
async fn a_duplicated_card_keeps_its_own_choices_and_values() {
    let fx = Fixture::new().await;
    let character = fx.new_type("Personnage", None).await;
    let card = fx.card(&character, "Aragorn").await;
    let status = create(
        fx.pool(),
        PropertyOwner::Card {
            card_id: card.clone(),
        },
        "Statut",
        PropertyKind::Select,
    )
    .await
    .unwrap();
    let status = set_options(fx.pool(), &status.id, &[new_option("Vivant")], true)
        .await
        .unwrap();
    let chosen = status.options[0].id.clone();
    set_value(fx.pool(), &card, &status.id, Some(select(&[&chosen])))
        .await
        .unwrap();

    let copy = cards::duplicate(fx.pool(), &card, "Copie").await.unwrap();
    let shown = of_card(fx.pool(), &copy.id).await.unwrap();
    assert_eq!(shown[0].definition.options, status.options);
    assert!(shown[0].definition.multiple);
    assert_ne!(shown[0].definition.id, status.id);
    assert_eq!(shown[0].value, Some(select(&[&chosen])));
}

/// A world made before migration 0025, with its properties and values.
#[tokio::test]
async fn the_migration_keeps_existing_properties_and_values() {
    use sqlx::Row;
    use sqlx::migrate::Migrator;

    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("old.db");
    let pool = db::connect(&path, true).await.unwrap();
    let up_to = |version: i64| Migrator {
        migrations: db::MIGRATOR
            .migrations
            .iter()
            .filter(|migration| migration.version <= version)
            .cloned()
            .collect::<Vec<_>>()
            .into(),
        ..Migrator::DEFAULT
    };
    up_to(24).run(&pool).await.unwrap();

    let statements = [
        "INSERT INTO documents (id, kind, title, sort_order, created_at, updated_at)
         VALUES ('c1', 'card', 'Aragorn', 0, '2026-01-01', '2026-01-01')",
        "INSERT INTO cards (document_id) VALUES ('c1')",
        "INSERT INTO relation_types (id, builtin, name, icon, inverse_id, category, sort_order)
         VALUES ('r1', NULL, 'Rival', 'swords', NULL, 'other', 99)",
        "INSERT INTO property_definitions (id, card_id, label, kind, target_type_ids,
             relation_type_id, applies_to_existing, sort_order, created_at)
         VALUES ('age', 'c1', 'Âge', 'number', '[]', NULL, 1, 0, '2026-01-01'),
                ('foe', 'c1', 'Rival', 'cards', '[\"t1\"]', 'r1', 0, 1, '2026-01-01')",
        r#"INSERT INTO property_values (card_id, property_id, value)
           VALUES ('c1', 'age', '{"kind":"number","value":87.0}'),
                  ('c1', 'foe', '{"kind":"cards","value":["c1"]}')"#,
    ];
    for statement in statements {
        sqlx::query(statement).execute(&pool).await.unwrap();
    }

    db::MIGRATOR.run(&pool).await.unwrap();

    let foe = queries::get(&pool, "foe").await.unwrap().unwrap();
    assert_eq!(foe.kind, "cards");
    assert_eq!(foe.target_type_ids, r#"["t1"]"#);
    assert_eq!(foe.relation_type_id.as_deref(), Some("r1"));
    assert_eq!(foe.options, "[]");
    assert_eq!(foe.multiple, 0);
    assert_eq!(foe.sort_order, 1);
    let age = queries::get(&pool, "age").await.unwrap().unwrap();
    assert_eq!(age.applies_to_existing, 1);

    let rows = sqlx::query("SELECT property_id, value FROM property_values ORDER BY property_id")
        .fetch_all(&pool)
        .await
        .unwrap();
    assert_eq!(rows.len(), 2);
    assert_eq!(rows[0].get::<String, _>("property_id"), "age");
    assert_eq!(
        rows[0].get::<String, _>("value"),
        r#"{"kind":"number","value":87.0}"#
    );

    // The rebuilt table cascades as before.
    sqlx::query("DELETE FROM property_definitions WHERE id = 'age'")
        .execute(&pool)
        .await
        .unwrap();
    assert_eq!(queries::count_values(&pool, "age").await.unwrap(), 0);
}
