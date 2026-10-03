use super::*;
use crate::domain::media;
use crate::world::{self, OpenWorld};

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
}

fn scene(elements: &str) -> String {
    format!(r#"{{"elements":[{elements}]}}"#)
}

#[tokio::test]
async fn a_canvas_reads_back_what_was_saved() {
    let fx = Fixture::new().await;
    let canvas = create(fx.pool(), "Idées").await.unwrap();
    assert_eq!(canvas.scene, EMPTY_SCENE);
    assert_eq!(canvas.app_state, EMPTY_APP_STATE);

    let drawn = scene(r#"{"id":"a","type":"rectangle","x":1,"y":2,"customData":{"kind":"note"}}"#);
    let state = r#"{"scrollX":10,"scrollY":-4,"zoom":{"value":1.5}}"#;
    save(fx.pool(), &canvas.id, &drawn, state).await.unwrap();
    let again = get(fx.pool(), &canvas.id).await.unwrap();
    assert_eq!(again.scene, drawn);
    assert_eq!(again.app_state, state);
    assert_eq!(again.title, "Idées");
}

#[tokio::test]
async fn a_scene_is_refused_with_image_bytes_bad_json_or_too_big() {
    let fx = Fixture::new().await;
    let canvas = create(fx.pool(), "Idées").await.unwrap();
    let with_bytes = r#"{"elements":[],"files":{"x":{"dataURL":"data:image/png;base64,AAAA"}}}"#;
    assert!(save(fx.pool(), &canvas.id, with_bytes, "{}").await.is_err());
    assert!(save(fx.pool(), &canvas.id, "not json", "{}").await.is_err());
    assert!(
        save(fx.pool(), &canvas.id, r#"{"other":1}"#, "{}")
            .await
            .is_err()
    );
    assert!(save(fx.pool(), &canvas.id, &scene(""), "[]").await.is_err());
    let huge = scene(&format!(
        r#"{{"id":"t","type":"text","text":"{}"}}"#,
        "a".repeat(MAX_SCENE_BYTES)
    ));
    assert!(save(fx.pool(), &canvas.id, &huge, "{}").await.is_err());
    // Nothing was written.
    assert_eq!(get(fx.pool(), &canvas.id).await.unwrap().scene, EMPTY_SCENE);
    assert!(save(fx.pool(), "nowhere", &scene(""), "{}").await.is_err());
}

#[tokio::test]
async fn the_images_of_a_canvas_are_usages_of_their_assets() {
    let fx = Fixture::new().await;
    let shown = fx.image("shown").await;
    let removed = fx.image("removed").await;
    let canvas = create(fx.pool(), "Mood board").await.unwrap();
    let images = scene(&format!(
        r#"{{"id":"a","type":"image","fileId":"{shown}"}},{{"id":"b","type":"image","fileId":"{removed}","isDeleted":true}},{{"id":"c","type":"image","fileId":"unknown.png"}}"#
    ));
    save(fx.pool(), &canvas.id, &images, "{}").await.unwrap();

    let usages = media::card_usages(fx.pool(), &shown).await.unwrap();
    assert_eq!(
        usages,
        vec![media::AssetUsage::CanvasImage {
            canvas_id: canvas.id.clone(),
            canvas_title: "Mood board".into(),
            in_trash: false,
        }]
    );
    // An element deleted in the scene does not use its asset.
    assert!(
        media::card_usages(fx.pool(), &removed)
            .await
            .unwrap()
            .is_empty()
    );

    // Deleting the asset leaves the scene as it is; the usage goes.
    media::delete(fx.pool(), &fx.world.assets_dir(), &shown)
        .await
        .unwrap();
    assert_eq!(get(fx.pool(), &canvas.id).await.unwrap().scene, images);
    assert!(
        media::card_usages(fx.pool(), &shown)
            .await
            .unwrap()
            .is_empty()
    );
}

#[tokio::test]
async fn a_canvas_is_duplicated_trashed_and_deleted_like_a_document() {
    let fx = Fixture::new().await;
    let image = fx.image("one").await;
    let canvas = create(fx.pool(), "Idées").await.unwrap();
    let drawn = scene(&format!(
        r#"{{"id":"a","type":"image","fileId":"{image}"}}"#
    ));
    save(fx.pool(), &canvas.id, &drawn, r#"{"gridSize":20}"#)
        .await
        .unwrap();

    let copy = duplicate(fx.pool(), &canvas.id, "Idées (copie)")
        .await
        .unwrap();
    assert_ne!(copy.id, canvas.id);
    assert_eq!(copy.scene, drawn);
    assert_eq!(copy.app_state, r#"{"gridSize":20}"#);
    assert_eq!(
        media::card_usages(fx.pool(), &image).await.unwrap().len(),
        2
    );

    documents::trash(fx.pool(), &copy.id).await.unwrap();
    let usages = media::card_usages(fx.pool(), &image).await.unwrap();
    assert!(usages.contains(&media::AssetUsage::CanvasImage {
        canvas_id: copy.id.clone(),
        canvas_title: "Idées (copie)".into(),
        in_trash: true,
    }));
    documents::delete_forever(fx.pool(), &copy.id)
        .await
        .unwrap();
    assert!(get(fx.pool(), &copy.id).await.is_err());
    assert_eq!(
        media::card_usages(fx.pool(), &image).await.unwrap().len(),
        1
    );
}
