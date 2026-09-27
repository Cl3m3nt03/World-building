//! Card type tests, on a real world (real migrations) in a temp folder.

use super::*;
use crate::db;
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

fn top_level(types: &[CardType]) -> Vec<&str> {
    types
        .iter()
        .filter(|t| t.parent_id.is_none())
        .map(|t| t.name.as_str())
        .collect()
}

fn subtypes_of<'a>(types: &'a [CardType], name: &str) -> Vec<&'a str> {
    let parent = types.iter().find(|t| t.name == name).unwrap();
    types
        .iter()
        .filter(|t| t.parent_id.as_deref() == Some(parent.id.as_str()))
        .map(|t| t.name.as_str())
        .collect()
}

fn new_type(name: &str, parent_id: Option<&str>) -> NewCardType {
    NewCardType {
        parent_id: parent_id.map(str::to_owned),
        name: name.into(),
        icon: "swords".into(),
        color: "red".into(),
    }
}

const COMMON_FR: [&str; 7] = [
    "Personnage",
    "Lieu",
    "Objet",
    "Événement",
    "Faction",
    "Lore",
    "Note",
];

#[tokio::test]
async fn every_genre_gets_the_common_types_plus_its_own() {
    let cases: [(Genre, &[&str]); 6] = [
        (
            Genre::Fantasy,
            &[
                "Système de magie",
                "Religion",
                "Race",
                "Créature",
                "Écologie",
            ],
        ),
        (
            Genre::ScienceFiction,
            &["Technologie", "Vaisseau", "Espèce", "Planète"],
        ),
        (Genre::Cyberpunk, &["Technologie", "Corporation", "Implant"]),
        (Genre::Romance, &["Relation", "Lieu de rencontre"]),
        (Genre::Contemporary, &["Organisation", "Relation"]),
        (Genre::Other, &[]),
    ];
    for (genre, extra) in cases {
        let fx = Fixture::new().await;
        assert!(
            ensure_defaults(fx.pool(), genre, Language::Fr)
                .await
                .unwrap()
        );

        let types = list(fx.pool()).await.unwrap();
        let expected: Vec<&str> = COMMON_FR.iter().chain(extra).copied().collect();
        assert_eq!(top_level(&types), expected, "{genre:?}");
    }
}

#[tokio::test]
async fn location_subtypes_follow_the_genre() {
    let fx = Fixture::new().await;
    ensure_defaults(fx.pool(), Genre::ScienceFiction, Language::Fr)
        .await
        .unwrap();
    let types = list(fx.pool()).await.unwrap();
    assert_eq!(
        subtypes_of(&types, "Lieu"),
        ["Système stellaire", "Station", "Colonie", "Base"]
    );
    // List order: each type directly followed by its subtypes.
    let names: Vec<&str> = types.iter().map(|t| t.name.as_str()).collect();
    assert_eq!(
        &names[..6],
        [
            "Personnage",
            "Lieu",
            "Système stellaire",
            "Station",
            "Colonie",
            "Base"
        ]
    );
}

#[tokio::test]
async fn defaults_are_named_in_the_app_language_with_their_template() {
    let fx = Fixture::new().await;
    ensure_defaults(fx.pool(), Genre::Fantasy, Language::En)
        .await
        .unwrap();
    let types = list(fx.pool()).await.unwrap();
    assert_eq!(top_level(&types)[..2], ["Character", "Location"]);
    assert_eq!(subtypes_of(&types, "Location")[0], "Kingdom");

    let character = &types[0];
    assert_eq!(character.icon, "user");
    let titles: Vec<&str> = character
        .guided_template
        .iter()
        .map(|s| s.title.as_str())
        .collect();
    assert_eq!(titles, ["Background", "Personality", "Appearance"]);
    assert!(!character.guided_template[0].prompt.is_empty());
}

#[tokio::test]
async fn defaults_are_created_only_once() {
    let fx = Fixture::new().await;
    assert!(
        ensure_defaults(fx.pool(), Genre::Other, Language::Fr)
            .await
            .unwrap()
    );
    // Every type deleted: they do not come back on the next opening.
    for card_type in list(fx.pool()).await.unwrap() {
        if card_type.parent_id.is_none() {
            delete(fx.pool(), &card_type.id, None).await.unwrap();
        }
    }
    assert!(
        !ensure_defaults(fx.pool(), Genre::Fantasy, Language::Fr)
            .await
            .unwrap()
    );
    assert!(list(fx.pool()).await.unwrap().is_empty());
}

#[tokio::test]
async fn create_update_and_subtypes() {
    let fx = Fixture::new().await;
    let artifact = create(fx.pool(), new_type("  Artefact ", None))
        .await
        .unwrap();
    assert_eq!(artifact.name, "Artefact");
    assert_eq!(artifact.orientation, Orientation::Portrait);

    let relic = create(fx.pool(), new_type("Relique", Some(&artifact.id)))
        .await
        .unwrap();
    assert_eq!(relic.parent_id.as_deref(), Some(artifact.id.as_str()));
    // Subtypes have no subtypes.
    assert!(
        create(fx.pool(), new_type("Fragment", Some(&relic.id)))
            .await
            .is_err()
    );

    let updated = update(
        fx.pool(),
        &artifact.id,
        CardTypePatch {
            color: Some("violet".into()),
            orientation: Some(Orientation::Landscape),
            canvas_format: Some(CanvasFormat::Wide),
            guided_template: Some(vec![TemplateSection {
                title: "Pouvoir".into(),
                prompt: "Que fait-il ?".into(),
            }]),
            ..CardTypePatch::default()
        },
    )
    .await
    .unwrap();
    assert_eq!(updated.color, "violet");
    assert_eq!(updated.name, "Artefact");
    assert_eq!(get(fx.pool(), &artifact.id).await.unwrap(), updated);
}

#[tokio::test]
async fn invalid_values_are_refused() {
    let fx = Fixture::new().await;
    assert!(create(fx.pool(), new_type(" ", None)).await.is_err());
    let mut bad_color = new_type("X", None);
    bad_color.color = "#ff0000".into();
    assert!(create(fx.pool(), bad_color).await.is_err());
    let mut bad_icon = new_type("X", None);
    bad_icon.icon = "../../etc".into();
    assert!(create(fx.pool(), bad_icon).await.is_err());
}

#[tokio::test]
async fn duplicate_copies_the_subtypes() {
    let fx = Fixture::new().await;
    ensure_defaults(fx.pool(), Genre::Fantasy, Language::Fr)
        .await
        .unwrap();
    let types = list(fx.pool()).await.unwrap();
    let location = types.iter().find(|t| t.name == "Lieu").unwrap();

    let copy = duplicate(fx.pool(), &location.id, "Lieu (copie)")
        .await
        .unwrap();

    let types = list(fx.pool()).await.unwrap();
    assert_eq!(top_level(&types).last(), Some(&"Lieu (copie)"));
    assert_eq!(
        subtypes_of(&types, "Lieu (copie)"),
        subtypes_of(&types, "Lieu")
    );
    assert_eq!(copy.icon, location.icon);
}

#[tokio::test]
async fn reorder_needs_every_sibling() {
    let fx = Fixture::new().await;
    let a = create(fx.pool(), new_type("A", None)).await.unwrap();
    let b = create(fx.pool(), new_type("B", None)).await.unwrap();
    let c = create(fx.pool(), new_type("C", None)).await.unwrap();

    reorder(fx.pool(), &[c.id.clone(), a.id.clone(), b.id.clone()])
        .await
        .unwrap();
    assert_eq!(top_level(&list(fx.pool()).await.unwrap()), ["C", "A", "B"]);

    assert!(
        reorder(fx.pool(), &[a.id.clone(), b.id.clone()])
            .await
            .is_err()
    );
}

#[tokio::test]
async fn deleting_a_type_deletes_its_subtypes() {
    let fx = Fixture::new().await;
    let place = create(fx.pool(), new_type("Lieu", None)).await.unwrap();
    let city = create(fx.pool(), new_type("Ville", Some(&place.id)))
        .await
        .unwrap();
    let other = create(fx.pool(), new_type("Note", None)).await.unwrap();

    // Cards cannot move to a type being deleted.
    assert!(delete(fx.pool(), &place.id, Some(&city.id)).await.is_err());
    assert!(delete(fx.pool(), &place.id, Some(&place.id)).await.is_err());

    delete(fx.pool(), &place.id, Some(&other.id)).await.unwrap();
    let names: Vec<String> = list(fx.pool())
        .await
        .unwrap()
        .into_iter()
        .map(|t| t.name)
        .collect();
    assert_eq!(names, ["Note"]);
}
