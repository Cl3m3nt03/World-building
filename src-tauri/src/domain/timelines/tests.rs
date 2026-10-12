use super::*;
use crate::domain::cards;

async fn world() -> (tempfile::TempDir, crate::world::OpenWorld) {
    let dir = tempfile::tempdir().unwrap();
    let world = crate::world::create(&dir.path().join("W"), "W", &db::MIGRATOR)
        .await
        .unwrap();
    (dir, world)
}

fn item(
    track: &str,
    title: &str,
    start: i32,
    end: Option<i32>,
    card: Option<&str>,
) -> TimelineItem {
    TimelineItem {
        id: Uuid::new_v4().to_string(),
        track_id: track.to_owned(),
        card_id: card.map(str::to_owned),
        title: title.to_owned(),
        color: "amber".to_owned(),
        description: String::new(),
        start,
        end,
        precision: DatePrecision::Year,
    }
}

async fn cited_by(pool: &SqlitePool, card: &str) -> Vec<String> {
    crate::db::links::to_target(pool, card)
        .await
        .unwrap()
        .into_iter()
        .filter(|link| link.kind == "timeline")
        .map(|link| link.source_id)
        .collect()
}

async fn a_card(pool: &SqlitePool, title: &str) -> String {
    let type_id = crate::domain::card_types::create(
        pool,
        crate::domain::card_types::NewCardType {
            parent_id: None,
            name: format!("Type {title}"),
            icon: "user".into(),
            color: "blue".into(),
        },
    )
    .await
    .unwrap()
    .id;
    cards::create(pool, &type_id, title).await.unwrap().id
}

#[tokio::test]
async fn a_new_timeline_has_one_track_and_is_a_document() {
    let (_dir, world) = world().await;
    let timeline = create(&world.pool, "Histoire de Westeros", "Événements")
        .await
        .unwrap();
    assert_eq!(timeline.title, "Histoire de Westeros");
    assert_eq!(timeline.tracks.len(), 1);
    assert_eq!(timeline.tracks[0].name, "Événements");
    assert!(timeline.items.is_empty());
    let tree = crate::domain::tree::tree(&world.pool).await.unwrap();
    assert!(
        tree.documents
            .iter()
            .any(|d| d.id == timeline.id && d.kind == DocumentKind::Timeline)
    );
    assert!(create(&world.pool, "  ", "x").await.is_err());
}

#[tokio::test]
async fn tracks_are_added_renamed_moved_and_deleted_but_one_stays() {
    let (_dir, world) = world().await;
    let timeline = create(&world.pool, "Frise", "Guerres").await.unwrap();
    let timeline = add_track(&world.pool, &timeline.id, "Règnes", "red")
        .await
        .unwrap();
    let timeline = add_track(&world.pool, &timeline.id, "Maisons", "blue")
        .await
        .unwrap();
    let names = |t: &Timeline| {
        t.tracks
            .iter()
            .map(|track| track.name.clone())
            .collect::<Vec<_>>()
    };
    assert_eq!(names(&timeline), ["Guerres", "Règnes", "Maisons"]);
    let maisons = timeline.tracks[2].id.clone();
    let timeline = move_track(&world.pool, &maisons, 0).await.unwrap();
    assert_eq!(names(&timeline), ["Maisons", "Guerres", "Règnes"]);
    let timeline = update_track(&world.pool, &maisons, "Grandes maisons", "violet")
        .await
        .unwrap();
    assert_eq!(timeline.tracks[0].name, "Grandes maisons");
    assert_eq!(timeline.tracks[0].color, "violet");
    assert!(
        add_track(&world.pool, &timeline.id, "x", "fuchsia")
            .await
            .is_err()
    );

    let mut timeline = timeline;
    for track in timeline.tracks.clone().iter().skip(1) {
        timeline = delete_track(&world.pool, &track.id).await.unwrap();
    }
    assert_eq!(timeline.tracks.len(), 1);
    assert!(
        delete_track(&world.pool, &timeline.tracks[0].id)
            .await
            .is_err()
    );
}

#[tokio::test]
async fn items_stand_for_cards_which_then_cite_the_timeline() {
    let (_dir, world) = world().await;
    let robert = a_card(&world.pool, "Robert Baratheon").await;
    let timeline = create(&world.pool, "Frise", "Règnes").await.unwrap();
    let track = timeline.tracks[0].id.clone();

    // A period (a reign) for Robert, an event without a card.
    let reign = item(
        &track,
        "Règne de Robert",
        283 * 360,
        Some(298 * 360),
        Some(&robert),
    );
    save_item(&world.pool, &reign).await.unwrap();
    let timeline = save_item(
        &world.pool,
        &item(&track, "Mort de Jon Arryn", 298 * 360, None, None),
    )
    .await
    .unwrap();
    assert_eq!(timeline.items.len(), 2);
    assert_eq!(timeline.items[0].title, "Règne de Robert");
    assert_eq!(
        cited_by(&world.pool, &robert).await,
        std::slice::from_ref(&timeline.id)
    );

    // Changed: moved later, still one item; the card is no longer cited once unlinked.
    let mut moved = reign.clone();
    moved.start += 360;
    moved.card_id = None;
    let timeline = save_item(&world.pool, &moved).await.unwrap();
    assert_eq!(timeline.items.len(), 2);
    assert_eq!(
        timeline
            .items
            .iter()
            .find(|i| i.id == reign.id)
            .unwrap()
            .start,
        284 * 360
    );
    assert!(cited_by(&world.pool, &robert).await.is_empty());

    let timeline = delete_item(&world.pool, &reign.id).await.unwrap();
    assert_eq!(timeline.items.len(), 1);
    assert!(delete_item(&world.pool, &reign.id).await.is_err());
}

#[tokio::test]
async fn bad_items_are_refused() {
    let (_dir, world) = world().await;
    let timeline = create(&world.pool, "Frise", "Piste").await.unwrap();
    let other = create(&world.pool, "Autre", "Piste").await.unwrap();
    let track = timeline.tracks[0].id.clone();

    // A period that ends before it starts, an unknown colour, a missing card or track.
    assert!(
        save_item(&world.pool, &item(&track, "x", 10, Some(5), None))
            .await
            .is_err()
    );
    let mut colour = item(&track, "x", 1, None, None);
    colour.color = "#ff0000".into();
    assert!(save_item(&world.pool, &colour).await.is_err());
    assert!(
        save_item(&world.pool, &item(&track, "x", 1, None, Some("nope")))
            .await
            .is_err()
    );
    assert!(
        save_item(&world.pool, &item("nope", "x", 1, None, None))
            .await
            .is_err()
    );

    // An item stays on its timeline.
    let event = item(&track, "x", 1, None, None);
    save_item(&world.pool, &event).await.unwrap();
    let mut elsewhere = event.clone();
    elsewhere.track_id = other.tracks[0].id.clone();
    assert!(save_item(&world.pool, &elsewhere).await.is_err());
}

#[tokio::test]
async fn a_deleted_timeline_takes_its_tracks_items_and_links() {
    let (_dir, world) = world().await;
    let card = a_card(&world.pool, "Aegon").await;
    let timeline = create(&world.pool, "Frise", "Piste").await.unwrap();
    save_item(
        &world.pool,
        &item(&timeline.tracks[0].id, "Conquête", 0, None, Some(&card)),
    )
    .await
    .unwrap();
    crate::domain::documents::trash(&world.pool, &timeline.id)
        .await
        .unwrap();
    crate::domain::documents::delete_forever(&world.pool, &timeline.id)
        .await
        .unwrap();
    assert!(get(&world.pool, &timeline.id).await.is_err());
    assert!(cited_by(&world.pool, &card).await.is_empty());
}
