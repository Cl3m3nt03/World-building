use super::*;
use crate::domain::card_types::{self, NewCardType};
use crate::domain::{cards, media};
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

    /// An image of the media library; `tag` makes its content unique.
    async fn image(&self, tag: &str) -> String {
        let source = self.dir.path().join(format!("{tag}.png"));
        let mut bytes = PIXEL_PNG.to_vec();
        bytes.extend_from_slice(tag.as_bytes());
        std::fs::write(&source, bytes).unwrap();
        media::import(self.pool(), &self.world.assets_dir(), &source)
            .await
            .unwrap()
            .asset
            .id
    }

    async fn card(&self, title: &str) -> String {
        let place = card_types::create(
            self.pool(),
            NewCardType {
                parent_id: None,
                name: format!("Type {title}"),
                icon: "map-pin".into(),
                color: "green".into(),
            },
        )
        .await
        .unwrap()
        .id;
        cards::create(self.pool(), &place, title).await.unwrap().id
    }
}

fn zone(id: &str, layer: &str, card: Option<&str>, vertices: usize) -> MapZone {
    MapZone {
        id: id.into(),
        layer_id: layer.into(),
        points: (0..vertices)
            .map(|i| {
                let angle = i as f64 / vertices as f64 * std::f64::consts::TAU;
                [0.5 + 0.3 * angle.cos(), 0.5 + 0.3 * angle.sin()]
            })
            .collect(),
        label: "Mordor".into(),
        label_style: LabelStyle {
            font: "serif".into(),
            size: 24.0,
        },
        card_id: card.map(str::to_owned),
        fill_color: "#7a1f1f".into(),
        opacity: 0.4,
        pattern: ZonePattern::Hatch,
    }
}

fn pin(id: &str, layer: &str, card: Option<&str>) -> MapPin {
    MapPin {
        id: id.into(),
        layer_id: layer.into(),
        card_id: card.map(str::to_owned),
        x: 0.25,
        y: 0.75,
        icon: "castle".into(),
        color: "#c0a060".into(),
        label: "Minas Tirith".into(),
        size: 1.5,
    }
}

fn text(id: &str, layer: &str) -> MapText {
    MapText {
        id: id.into(),
        layer_id: layer.into(),
        x: 0.5,
        y: 0.1,
        text: "Terre du Milieu".into(),
        style: TextStyle {
            font: "serif".into(),
            size: 48.0,
            spacing: 0.3,
            arc: -0.4,
            scale_with_zoom: true,
        },
    }
}

#[tokio::test]
async fn a_map_and_its_content_read_back_the_same() {
    let fx = Fixture::new().await;
    let background = fx.image("arda").await;
    let map = create(fx.pool(), "Arda", &background, "Calque 1")
        .await
        .unwrap();
    assert_eq!(map.title, "Arda");
    assert_eq!(
        map.background_asset_id.as_deref(),
        Some(background.as_str())
    );
    assert_eq!((map.width, map.height), (1, 1));
    assert_eq!(map.content.layers.len(), 1);
    assert_eq!(map.content.layers[0].name, "Calque 1");

    let base = map.content.layers[0].id.clone();
    let mut content = map.content.clone();
    content.layers.push(MapLayer {
        id: "villes".into(),
        name: "Villes".into(),
        visible: false,
    });
    content.pins.push(pin("p1", "villes", None));
    content.zones.push(zone("z1", &base, None, 10));
    content.texts.push(text("t1", &base));
    save(fx.pool(), &map.id, &content).await.unwrap();

    let read = get(fx.pool(), &map.id).await.unwrap();
    assert_eq!(read.content, content);
    let document = documents::get(fx.pool(), &map.id).await.unwrap();
    assert_eq!(document.kind, DocumentKind::Map);
}

#[tokio::test]
async fn pins_and_zones_tied_to_cards_are_backlinks() {
    let fx = Fixture::new().await;
    let gondor = fx.card("Gondor").await;
    let mordor = fx.card("Mordor").await;
    let map = create(fx.pool(), "Arda", &fx.image("arda").await, "Calque")
        .await
        .unwrap();
    let layer = map.content.layers[0].id.clone();
    let mut content = map.content.clone();
    content.pins.push(pin("p1", &layer, Some(&gondor)));
    content.pins.push(pin("p2", &layer, Some(&gondor)));
    content.zones.push(zone("z1", &layer, Some(&mordor), 3));
    save(fx.pool(), &map.id, &content).await.unwrap();

    for card in [&gondor, &mordor] {
        let backlinks = links::backlinks(fx.pool(), card).await.unwrap();
        assert_eq!(backlinks.len(), 1, "one backlink to {card}");
    }

    // The pin removed: its link goes with it.
    content.pins.clear();
    save(fx.pool(), &map.id, &content).await.unwrap();
    assert!(
        links::backlinks(fx.pool(), &gondor)
            .await
            .unwrap()
            .is_empty()
    );
    assert_eq!(links::backlinks(fx.pool(), &mordor).await.unwrap().len(), 1);
}

#[tokio::test]
async fn bad_contents_are_refused() {
    let fx = Fixture::new().await;
    let map = create(fx.pool(), "Arda", &fx.image("arda").await, "Calque")
        .await
        .unwrap();
    let layer = map.content.layers[0].id.clone();
    let with = |change: &dyn Fn(&mut MapContent)| {
        let mut content = map.content.clone();
        change(&mut content);
        content
    };
    let bad = [
        with(&|c| c.layers.clear()),
        with(&|c| c.pins.push(pin("p", "nowhere", None))),
        with(&|c| {
            let mut outside = pin("p", &layer, None);
            outside.x = 1.5;
            c.pins.push(outside);
        }),
        with(&|c| c.zones.push(zone("z", &layer, None, 2))),
        with(&|c| {
            c.pins.push(pin("same", &layer, None));
            c.texts.push(text("same", &layer));
        }),
        with(&|c| {
            let mut bent = text("t", &layer);
            bent.style.arc = 3.0;
            c.texts.push(bent);
        }),
    ];
    for content in &bad {
        assert!(
            save(fx.pool(), &map.id, content).await.is_err(),
            "{content:?}"
        );
    }
    assert!(save(fx.pool(), "no-such-map", &map.content).await.is_err());
    // Nothing of the refused saves was kept.
    assert_eq!(get(fx.pool(), &map.id).await.unwrap().content, map.content);
}

#[tokio::test]
async fn a_new_background_keeps_what_is_on_the_map() {
    let fx = Fixture::new().await;
    let map = create(fx.pool(), "Arda", &fx.image("first").await, "Calque")
        .await
        .unwrap();
    let layer = map.content.layers[0].id.clone();
    let mut content = map.content.clone();
    content.pins.push(pin("p1", &layer, None));
    content.zones.push(zone("z1", &layer, None, 4));
    content.texts.push(text("t1", &layer));
    save(fx.pool(), &map.id, &content).await.unwrap();

    let second = fx.image("second").await;
    let changed = set_background(fx.pool(), &map.id, &second).await.unwrap();
    assert_eq!(
        changed.background_asset_id.as_deref(),
        Some(second.as_str())
    );
    assert_eq!(changed.content, content);

    // A map background is an image of the media library.
    assert!(
        set_background(fx.pool(), &map.id, "missing.png")
            .await
            .is_err()
    );
    assert!(
        create(fx.pool(), "Vide", "missing.png", "Calque")
            .await
            .is_err()
    );
}

#[tokio::test]
async fn a_deleted_background_is_a_usage_then_leaves_the_map_bare() {
    let fx = Fixture::new().await;
    let background = fx.image("arda").await;
    let map = create(fx.pool(), "Arda", &background, "Calque")
        .await
        .unwrap();

    let usages = media::card_usages(fx.pool(), &background).await.unwrap();
    assert_eq!(
        usages,
        vec![media::AssetUsage::MapBackground {
            map_id: map.id.clone(),
            map_title: "Arda".into(),
            in_trash: false,
        }]
    );
    media::delete(fx.pool(), &fx.world.assets_dir(), &background)
        .await
        .unwrap();
    assert_eq!(
        get(fx.pool(), &map.id).await.unwrap().background_asset_id,
        None
    );
}

#[tokio::test]
async fn a_map_is_duplicated_with_new_ids_and_deleted_with_its_content() {
    let fx = Fixture::new().await;
    let gondor = fx.card("Gondor").await;
    let map = create(fx.pool(), "Arda", &fx.image("arda").await, "Calque")
        .await
        .unwrap();
    let layer = map.content.layers[0].id.clone();
    let mut content = map.content.clone();
    content.pins.push(pin("p1", &layer, Some(&gondor)));
    content.zones.push(zone("z1", &layer, None, 5));
    save(fx.pool(), &map.id, &content).await.unwrap();

    let copy = duplicate(fx.pool(), &map.id, "Arda (copie)").await.unwrap();
    assert_eq!(copy.title, "Arda (copie)");
    assert_ne!(copy.content.layers[0].id, layer);
    assert_eq!(copy.content.pins[0].layer_id, copy.content.layers[0].id);
    assert_eq!(
        copy.content.pins[0].card_id.as_deref(),
        Some(gondor.as_str())
    );
    assert_eq!(copy.content.zones[0].points, content.zones[0].points);
    assert_eq!(links::backlinks(fx.pool(), &gondor).await.unwrap().len(), 2);

    documents::trash(fx.pool(), &map.id).await.unwrap();
    documents::delete_forever(fx.pool(), &map.id).await.unwrap();
    assert!(get(fx.pool(), &map.id).await.is_err());
    let left: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM map_pins")
        .fetch_one(fx.pool())
        .await
        .unwrap();
    assert_eq!(left, 1, "only the copy's pin is left");
}
