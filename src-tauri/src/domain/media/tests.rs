//! Media library tests, on a real world (real migrations) in a temp folder.

use super::*;
use crate::db;
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
    _dir: tempfile::TempDir,
    world: OpenWorld,
    sources: PathBuf,
}

impl Fixture {
    async fn new() -> Self {
        let dir = tempfile::tempdir().unwrap();
        let world = world::create(&dir.path().join("W"), "W", &db::MIGRATOR)
            .await
            .unwrap();
        let sources = dir.path().join("sources");
        std::fs::create_dir_all(&sources).unwrap();
        Self {
            _dir: dir,
            world,
            sources,
        }
    }

    fn source(&self, name: &str, content: &[u8]) -> PathBuf {
        let path = self.sources.join(name);
        std::fs::write(&path, content).unwrap();
        path
    }

    fn pool(&self) -> &SqlitePool {
        &self.world.pool
    }

    fn assets(&self) -> PathBuf {
        self.world.assets_dir()
    }
}

#[tokio::test]
async fn import_records_the_file_and_its_metadata() {
    let fx = Fixture::new().await;
    let source = fx.source("Portrait.png", PIXEL_PNG);

    let imported = import(fx.pool(), &fx.assets(), &source).await.unwrap();

    assert!(imported.created);
    let asset = imported.asset;
    assert_eq!(asset.name, "Portrait.png");
    assert_eq!(asset.kind, AssetKind::Image);
    assert_eq!(asset.mime, "image/png");
    assert_eq!(asset.size, PIXEL_PNG.len() as f64);
    assert_eq!((asset.width, asset.height), (Some(1), Some(1)));
    assert!(fx.assets().join(&asset.id).is_file());
    assert_eq!(
        list(fx.pool(), &AssetFilter::default()).await.unwrap(),
        vec![asset]
    );
}

#[tokio::test]
async fn importing_the_same_content_again_returns_the_existing_asset() {
    let fx = Fixture::new().await;
    let first = import(fx.pool(), &fx.assets(), &fx.source("a.png", PIXEL_PNG))
        .await
        .unwrap();
    rename(fx.pool(), &first.asset.id, "Mon portrait")
        .await
        .unwrap();

    let again = import(fx.pool(), &fx.assets(), &fx.source("b.png", PIXEL_PNG))
        .await
        .unwrap();

    assert!(!again.created);
    assert_eq!(again.asset.id, first.asset.id);
    assert_eq!(again.asset.name, "Mon portrait");
    assert_eq!(
        list(fx.pool(), &AssetFilter::default())
            .await
            .unwrap()
            .len(),
        1
    );
}

#[tokio::test]
async fn sync_records_files_imported_before_the_media_library() {
    let fx = Fixture::new().await;
    // As in 0.1.0: the file is in assets/ but has no row.
    let old = files::import(&fx.assets(), &fx.source("old.mp3", b"ID3 audio")).unwrap();
    std::fs::write(fx.assets().join(".import-leftover.tmp"), "x").unwrap();
    std::fs::write(fx.assets().join("notes.txt"), "not an asset id").unwrap();

    assert_eq!(sync(fx.pool(), &fx.assets()).await.unwrap(), 1);
    assert_eq!(
        sync(fx.pool(), &fx.assets()).await.unwrap(),
        0,
        "idempotent"
    );

    let assets = list(fx.pool(), &AssetFilter::default()).await.unwrap();
    assert_eq!(assets.len(), 1);
    assert_eq!(assets[0].id, old.id);
    assert_eq!(assets[0].kind, AssetKind::Audio);
}

#[tokio::test]
async fn list_filters_by_kind_and_name() {
    let fx = Fixture::new().await;
    import(
        fx.pool(),
        &fx.assets(),
        &fx.source("Carte du monde.png", PIXEL_PNG),
    )
    .await
    .unwrap();
    import(
        fx.pool(),
        &fx.assets(),
        &fx.source("Thème 100%.mp3", b"ID3 one"),
    )
    .await
    .unwrap();
    import(
        fx.pool(),
        &fx.assets(),
        &fx.source("notes_brutes.pdf", b"%PDF"),
    )
    .await
    .unwrap();

    let names = |assets: Vec<Asset>| assets.into_iter().map(|a| a.name).collect::<Vec<_>>();
    let images = AssetFilter {
        kind: Some(AssetKind::Image),
        search: None,
    };
    assert_eq!(
        names(list(fx.pool(), &images).await.unwrap()),
        ["Carte du monde.png"]
    );
    let search = |text: &str| AssetFilter {
        kind: None,
        search: Some(text.into()),
    };
    assert_eq!(
        names(list(fx.pool(), &search("CARTE")).await.unwrap()),
        ["Carte du monde.png"]
    );
    // LIKE wildcards in the search are literal characters.
    assert_eq!(
        names(list(fx.pool(), &search("100%")).await.unwrap()),
        ["Thème 100%.mp3"]
    );
    // As a wildcard, "_" would match the space of "Carte du monde".
    assert_eq!(
        names(list(fx.pool(), &search("Carte_du")).await.unwrap()),
        Vec::<String>::new()
    );
    assert_eq!(
        names(list(fx.pool(), &search("s_b")).await.unwrap()),
        ["notes_brutes.pdf"]
    );
    assert_eq!(list(fx.pool(), &search("   ")).await.unwrap().len(), 3);
}

#[tokio::test]
async fn rename_validates_the_name() {
    let fx = Fixture::new().await;
    let asset = import(fx.pool(), &fx.assets(), &fx.source("a.png", PIXEL_PNG))
        .await
        .unwrap()
        .asset;

    assert_eq!(
        rename(fx.pool(), &asset.id, "  Blason  ")
            .await
            .unwrap()
            .name,
        "Blason"
    );
    for bad in ["", "   ", &"x".repeat(MAX_NAME_LEN + 1)] {
        assert!(matches!(
            rename(fx.pool(), &asset.id, bad).await,
            Err(AppError::InvalidInput(_))
        ));
    }
    let unknown = format!("{}.png", "f".repeat(64));
    assert!(matches!(
        rename(fx.pool(), &unknown, "x").await,
        Err(AppError::InvalidInput(_))
    ));
}

#[tokio::test]
async fn delete_removes_the_row_and_the_file() {
    let fx = Fixture::new().await;
    let asset = import(fx.pool(), &fx.assets(), &fx.source("a.png", PIXEL_PNG))
        .await
        .unwrap()
        .asset;

    delete(fx.pool(), &fx.assets(), &asset.id).await.unwrap();

    assert!(!fx.assets().join(&asset.id).exists());
    assert!(
        list(fx.pool(), &AssetFilter::default())
            .await
            .unwrap()
            .is_empty()
    );
    assert!(matches!(
        delete(fx.pool(), &fx.assets(), &asset.id).await,
        Err(AppError::InvalidInput(_))
    ));
    assert!(matches!(
        delete(fx.pool(), &fx.assets(), "../world.db").await,
        Err(AppError::InvalidInput(_))
    ));
}

#[tokio::test]
async fn pasted_content_is_imported_under_the_given_name() {
    let fx = Fixture::new().await;

    let imported = import_bytes(
        fx.pool(),
        &fx.assets(),
        "Image collée.png",
        PIXEL_PNG.to_vec(),
    )
    .await
    .unwrap();

    assert!(imported.created);
    assert_eq!(imported.asset.name, "Image collée.png");
    assert_eq!(imported.asset.kind, AssetKind::Image);
    assert!(imported.asset.id.ends_with(".png"));
    // Only the asset itself is left in assets/, no temporary file.
    let files: Vec<_> = std::fs::read_dir(fx.assets()).unwrap().collect();
    assert_eq!(files.len(), 1);
}

#[tokio::test]
async fn empty_or_nameless_pasted_content_is_refused() {
    let fx = Fixture::new().await;
    assert!(matches!(
        import_bytes(fx.pool(), &fx.assets(), "a.png", Vec::new()).await,
        Err(AppError::InvalidInput(_))
    ));
    assert!(matches!(
        import_bytes(fx.pool(), &fx.assets(), "  ", PIXEL_PNG.to_vec()).await,
        Err(AppError::InvalidInput(_))
    ));
}
