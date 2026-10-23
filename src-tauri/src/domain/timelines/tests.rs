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
        image_asset_id: None,
        tags: Vec::new(),
        hidden: false,
        life: false,
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

#[tokio::test]
async fn a_copy_has_its_own_tracks_and_items_and_cites_the_same_cards() {
    let (_dir, world) = world().await;
    let card = a_card(&world.pool, "Aegon").await;
    let timeline = create(&world.pool, "Histoire", "Rois").await.unwrap();
    let track = timeline.tracks[0].id.clone();
    add_track(&world.pool, &timeline.id, "Guerres", "red")
        .await
        .unwrap();
    save_item(
        &world.pool,
        &item(&track, "Conquête", 0, Some(2), Some(&card)),
    )
    .await
    .unwrap();

    let copy = duplicate(&world.pool, &timeline.id, "Histoire (copie)")
        .await
        .unwrap();

    assert_eq!(copy.title, "Histoire (copie)");
    assert_eq!(
        copy.tracks
            .iter()
            .map(|t| t.name.as_str())
            .collect::<Vec<_>>(),
        ["Rois", "Guerres"]
    );
    assert!(
        copy.tracks
            .iter()
            .all(|t| !timeline.tracks.iter().any(|o| o.id == t.id))
    );
    assert_eq!(copy.items.len(), 1);
    assert_eq!(copy.items[0].track_id, copy.tracks[0].id);
    assert_eq!(copy.items[0].end, Some(2));
    let mut citing = cited_by(&world.pool, &card).await;
    citing.sort();
    let mut expected = vec![timeline.id.clone(), copy.id.clone()];
    expected.sort();
    assert_eq!(citing, expected);
    // The original is untouched.
    assert_eq!(get(&world.pool, &timeline.id).await.unwrap().items.len(), 1);
}

#[tokio::test]
async fn tags_are_tidied_and_images_and_hiding_are_kept() {
    let (_dir, world) = world().await;
    let timeline = create(&world.pool, "Histoire", "Guerres").await.unwrap();
    let mut war = item(&timeline.tracks[0].id, "Rébellion", 282, Some(283), None);
    war.tags = vec![
        " Guerre ".into(),
        "guerre".into(),
        String::new(),
        "Baratheon".into(),
    ];
    war.image_asset_id = Some(format!("{}.png", "a".repeat(64)));
    war.hidden = true;
    let saved = save_item(&world.pool, &war).await.unwrap();
    assert_eq!(saved.items[0].tags, ["Guerre", "Baratheon"]);
    assert_eq!(saved.items[0].image_asset_id, war.image_asset_id);
    assert!(saved.items[0].hidden);
    let users = db::timelines::using_asset(&world.pool, &format!("{}.png", "a".repeat(64)))
        .await
        .unwrap();
    assert_eq!(users.len(), 1);

    war.tags = vec!["x".repeat(MAX_TAG + 1)];
    assert!(save_item(&world.pool, &war).await.is_err());
    war.tags = (0..=MAX_TAGS).map(|n| n.to_string()).collect();
    assert!(save_item(&world.pool, &war).await.is_err());
    war.tags = Vec::new();
    war.image_asset_id = Some("../evil.png".into());
    assert!(save_item(&world.pool, &war).await.is_err());
}

#[tokio::test]
async fn only_a_period_standing_for_a_card_is_a_life() {
    let (_dir, world) = world().await;
    let ned = a_card(&world.pool, "Eddard Stark").await;
    let timeline = create(&world.pool, "Histoire", "Stark").await.unwrap();
    let track = timeline.tracks[0].id.clone();
    let mut life = item(&track, "", 263, Some(299), Some(&ned));
    life.life = true;
    let saved = save_item(&world.pool, &life).await.unwrap();
    assert!(saved.items[0].life);
    // An event, or a period without a card, is never a life.
    let mut event = item(&track, "Naissance", 263, None, Some(&ned));
    event.life = true;
    let mut war = item(&track, "Guerre", 282, Some(283), None);
    war.life = true;
    save_item(&world.pool, &event).await.unwrap();
    let saved = save_item(&world.pool, &war).await.unwrap();
    assert_eq!(saved.items.iter().filter(|each| each.life).count(), 1);
}

#[tokio::test]
async fn arrows_join_two_items_of_one_timeline_and_go_with_them() {
    let (_dir, world) = world().await;
    let timeline = create(&world.pool, "Histoire", "Guerres").await.unwrap();
    let track = timeline.tracks[0].id.clone();
    let rebellion = item(&track, "Rébellion", 282, Some(283), None);
    let reign = item(&track, "Règne", 283, Some(298), None);
    save_item(&world.pool, &rebellion).await.unwrap();
    save_item(&world.pool, &reign).await.unwrap();
    let link = TimelineLink {
        id: Uuid::new_v4().to_string(),
        from: rebellion.id.clone(),
        to: reign.id.clone(),
    };
    let saved = save_link(&world.pool, &link).await.unwrap();
    assert_eq!(saved.links, std::slice::from_ref(&link));
    // The same arrow again stays one; an item never leads to itself.
    let again = TimelineLink {
        id: Uuid::new_v4().to_string(),
        ..link.clone()
    };
    assert_eq!(save_link(&world.pool, &again).await.unwrap().links.len(), 1);
    let loop_link = TimelineLink {
        to: rebellion.id.clone(),
        ..again.clone()
    };
    assert!(save_link(&world.pool, &loop_link).await.is_err());
    // Not across timelines.
    let other = create(&world.pool, "Autre", "Piste").await.unwrap();
    let elsewhere = item(&other.tracks[0].id, "Ailleurs", 1, None, None);
    save_item(&world.pool, &elsewhere).await.unwrap();
    let across = TimelineLink {
        id: Uuid::new_v4().to_string(),
        from: rebellion.id.clone(),
        to: elsewhere.id.clone(),
    };
    assert!(save_link(&world.pool, &across).await.is_err());

    // The copy keeps its own arrow.
    let copy = duplicate(&world.pool, &timeline.id, "Copie").await.unwrap();
    assert_eq!(copy.links.len(), 1);
    assert_ne!(copy.links[0].from, rebellion.id);

    // Deleted with an item; deleted alone.
    assert!(
        delete_item(&world.pool, &reign.id)
            .await
            .unwrap()
            .links
            .is_empty()
    );
    assert!(
        delete_link(&world.pool, &copy.links[0].id)
            .await
            .unwrap()
            .links
            .is_empty()
    );
}
