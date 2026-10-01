use super::*;

/// A world's media library: its database (fully migrated) and `assets/`.
async fn world(dir: &Path) -> (SqlitePool, PathBuf) {
    std::fs::create_dir_all(dir).unwrap();
    let pool = db::connect(&dir.join("world.db"), true).await.unwrap();
    db::MIGRATOR.run(&pool).await.unwrap();
    let assets = dir.join("assets");
    std::fs::create_dir_all(&assets).unwrap();
    (pool, assets)
}

fn file(dir: &Path, name: &str, content: &str) -> PathBuf {
    let path = dir.join(name);
    std::fs::write(&path, content).unwrap();
    path
}

#[tokio::test]
async fn an_image_goes_from_one_world_to_another_through_the_library() {
    let tmp = tempfile::tempdir().unwrap();
    let library = open(&tmp.path().join("config")).await.unwrap();
    let (first, first_assets) = world(&tmp.path().join("first")).await;
    let (second, second_assets) = world(&tmp.path().join("second")).await;

    let source = file(tmp.path(), "carte.png", "png bytes");
    let imported = media::import(&first, &first_assets, &source)
        .await
        .unwrap()
        .asset;
    media::rename(&first, &imported.id, "Carte d'Erebor")
        .await
        .unwrap();

    let added = library
        .add_from_world(&first_assets, &imported.id, "Carte d'Erebor")
        .await
        .unwrap();
    assert!(added.created);
    assert_eq!(added.asset.id, imported.id);
    assert_eq!(added.asset.name, "Carte d'Erebor");

    let copied = library
        .copy_into_world(&imported.id, &second, &second_assets)
        .await
        .unwrap();
    assert!(copied.created);
    assert_eq!(copied.asset.name, "Carte d'Erebor");
    assert_eq!(
        std::fs::read_to_string(second_assets.join(&imported.id)).unwrap(),
        "png bytes"
    );

    // Picked again: the world's asset is kept, not duplicated.
    let again = library
        .copy_into_world(&imported.id, &second, &second_assets)
        .await
        .unwrap();
    assert!(!again.created);
    assert_eq!(
        media::list(&second, &AssetFilter::default())
            .await
            .unwrap()
            .len(),
        1
    );
}

#[tokio::test]
async fn removing_from_the_library_leaves_the_worlds_untouched() {
    let tmp = tempfile::tempdir().unwrap();
    let config = tmp.path().join("config");
    let library = open(&config).await.unwrap();
    let (world_pool, world_assets) = world(&tmp.path().join("world")).await;

    let asset = library
        .import(&file(tmp.path(), "foret.jpg", "jpg"))
        .await
        .unwrap()
        .asset;
    library.rename(&asset.id, "Forêt").await.unwrap();
    library
        .copy_into_world(&asset.id, &world_pool, &world_assets)
        .await
        .unwrap();

    library.remove(&asset.id).await.unwrap();

    assert!(
        library
            .list(&AssetFilter::default())
            .await
            .unwrap()
            .is_empty()
    );
    assert!(!assets_dir(&config).join(&asset.id).exists());
    assert!(world_assets.join(&asset.id).exists());
    assert!(library.remove(&asset.id).await.is_err());
    assert!(
        library
            .copy_into_world(&asset.id, &world_pool, &world_assets)
            .await
            .is_err()
    );
}

#[tokio::test]
async fn the_library_reopens_with_its_assets_and_refuses_bad_ids() {
    let tmp = tempfile::tempdir().unwrap();
    let config = tmp.path().join("config");
    let library = open(&config).await.unwrap();
    let asset = library
        .import(&file(tmp.path(), "a.png", "a"))
        .await
        .unwrap()
        .asset;
    library.pool.close().await;

    let reopened = open(&config).await.unwrap();
    let listed = reopened.list(&AssetFilter::default()).await.unwrap();
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].id, asset.id);

    let (pool, world_assets) = world(&tmp.path().join("world")).await;
    for id in ["../library.db", "library.db"] {
        assert!(
            reopened
                .copy_into_world(id, &pool, &world_assets)
                .await
                .is_err()
        );
        assert!(
            reopened
                .add_from_world(&world_assets, id, "x")
                .await
                .is_err()
        );
    }
}
