//! World folder tests, each in its own temporary directory.
//!
//! Migration tests use fixture migrators (`tests/fixtures/migrations_v*`), so
//! they do not depend on the real schema. Queries on those fixture tables use
//! the unchecked `sqlx::query`: the macros only know the real schema.

use sqlx::migrate::Migrator;

use super::*;
use crate::error::AppError;

static V1: Migrator = sqlx::migrate!("./tests/fixtures/migrations_v1");
static V2: Migrator = sqlx::migrate!("./tests/fixtures/migrations_v2");

fn temp_root() -> (tempfile::TempDir, PathBuf) {
    let dir = tempfile::tempdir().unwrap();
    let root = dir.path().join("MyWorld");
    (dir, root)
}

async fn note_count(pool: &SqlitePool) -> i64 {
    sqlx::query_scalar("SELECT COUNT(*) FROM notes")
        .fetch_one(pool)
        .await
        .unwrap()
}

// --- Creation ---------------------------------------------------------------

#[tokio::test]
async fn create_lays_out_the_world_folder() {
    let (_dir, root) = temp_root();

    let world = create(&root, "  Eldefleur  ", &db::MIGRATOR).await.unwrap();

    assert!(root.join(WORLD_FILE).is_file());
    assert!(root.join(DB_FILE).is_file());
    assert!(root.join(ASSETS_DIR).is_dir());

    let file = read_world_file(&root).unwrap();
    assert_eq!(file.format, FORMAT);
    assert_eq!(file.name, "Eldefleur");
    assert_eq!(file.schema_version, db::latest_version(&db::MIGRATOR));
    assert_eq!(file.created_at, file.last_opened_at);
    assert_eq!(world.file, file);

    let info = world.info();
    assert_eq!(info.id, file.id.to_string());
    assert_eq!(info.path, root.display().to_string());
    world.close().await;
}

#[tokio::test]
async fn create_enables_wal_and_foreign_keys() {
    let (_dir, root) = temp_root();
    let world = create(&root, "W", &db::MIGRATOR).await.unwrap();

    let journal: String = sqlx::query_scalar("PRAGMA journal_mode")
        .fetch_one(&world.pool)
        .await
        .unwrap();
    let foreign_keys: i64 = sqlx::query_scalar("PRAGMA foreign_keys")
        .fetch_one(&world.pool)
        .await
        .unwrap();
    assert_eq!(journal, "wal");
    assert_eq!(foreign_keys, 1);
    world.close().await;
}

#[tokio::test]
async fn create_accepts_an_existing_empty_folder() {
    let (_dir, root) = temp_root();
    std::fs::create_dir_all(&root).unwrap();

    let world = create(&root, "W", &db::MIGRATOR).await.unwrap();
    world.close().await;
    assert!(root.join(WORLD_FILE).is_file());
}

#[tokio::test]
async fn create_refuses_a_non_empty_folder_and_leaves_it_untouched() {
    let (_dir, root) = temp_root();
    std::fs::create_dir_all(&root).unwrap();
    std::fs::write(root.join("notes.txt"), "mine").unwrap();

    let error = create(&root, "W", &db::MIGRATOR).await.unwrap_err();

    assert!(
        matches!(error, AppError::WorldAlreadyExists(_)),
        "{error:?}"
    );
    assert_eq!(std::fs::read_dir(&root).unwrap().count(), 1);
}

#[tokio::test]
async fn create_refuses_an_empty_name() {
    let (_dir, root) = temp_root();
    let error = create(&root, "   ", &db::MIGRATOR).await.unwrap_err();
    assert!(matches!(error, AppError::InvalidInput(_)), "{error:?}");
    assert!(!root.exists());
}

#[tokio::test]
async fn create_refuses_a_relative_path() {
    let error = create(Path::new("relative/world"), "W", &db::MIGRATOR)
        .await
        .unwrap_err();
    assert!(matches!(error, AppError::InvalidInput(_)), "{error:?}");
}

// --- Reopening --------------------------------------------------------------

#[tokio::test]
async fn reopen_keeps_identity_and_data() {
    let (_dir, root) = temp_root();
    let created = create(&root, "Eldefleur", &V1).await.unwrap();
    sqlx::query("INSERT INTO notes (body) VALUES ('hello')")
        .execute(&created.pool)
        .await
        .unwrap();
    let id = created.file.id;
    let created_at = created.file.created_at;
    created.close().await;

    let reopened = open(&root, &V1).await.unwrap();

    assert_eq!(reopened.file.id, id);
    assert_eq!(reopened.file.name, "Eldefleur");
    assert_eq!(reopened.file.created_at, created_at);
    assert!(reopened.file.last_opened_at >= created_at);
    assert_eq!(note_count(&reopened.pool).await, 1);
    assert!(
        !backup_path(&root, 1).exists(),
        "no migration, so no backup"
    );
    reopened.close().await;
}

#[tokio::test]
async fn reopen_recreates_a_missing_assets_folder() {
    let (_dir, root) = temp_root();
    create(&root, "W", &V1).await.unwrap().close().await;
    std::fs::remove_dir(root.join(ASSETS_DIR)).unwrap();

    open(&root, &V1).await.unwrap().close().await;
    assert!(root.join(ASSETS_DIR).is_dir());
}

// --- Migration --------------------------------------------------------------

#[tokio::test]
async fn open_migrates_an_older_world_after_a_backup() {
    let (_dir, root) = temp_root();
    let v1 = create(&root, "W", &V1).await.unwrap();
    sqlx::query("INSERT INTO notes (body) VALUES ('before')")
        .execute(&v1.pool)
        .await
        .unwrap();
    v1.close().await;

    let v2 = open(&root, &V2).await.unwrap();

    // Migrated: new column and table, data kept, world.json updated.
    assert_eq!(v2.file.schema_version, 2);
    assert_eq!(read_world_file(&root).unwrap().schema_version, 2);
    assert_eq!(note_count(&v2.pool).await, 1);
    sqlx::query("INSERT INTO tags (label) VALUES ('x')")
        .execute(&v2.pool)
        .await
        .unwrap();
    let pinned: i64 = sqlx::query_scalar("SELECT pinned FROM notes")
        .fetch_one(&v2.pool)
        .await
        .unwrap();
    assert_eq!(pinned, 0);
    v2.close().await;

    // Backup: a v1 database with the data, without the v2 changes.
    let backup = backup_path(&root, 1);
    assert!(backup.is_file());
    let backup_pool = db::connect(&backup, false).await.unwrap();
    assert_eq!(note_count(&backup_pool).await, 1);
    assert_eq!(db::applied_version(&backup_pool).await.unwrap(), Some(1));
    let tags: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'tags'",
    )
    .fetch_one(&backup_pool)
    .await
    .unwrap();
    assert_eq!(tags, 0);
    backup_pool.close().await;
}

// --- Version refusal --------------------------------------------------------

#[tokio::test]
async fn open_refuses_a_newer_world_without_touching_it() {
    let (_dir, root) = temp_root();
    create(&root, "W", &V2).await.unwrap().close().await;
    let json_before = std::fs::read(root.join(WORLD_FILE)).unwrap();
    let db_before = std::fs::read(root.join(DB_FILE)).unwrap();

    let error = open(&root, &V1).await.unwrap_err();

    assert!(matches!(error, AppError::WorldTooNew(_)), "{error:?}");
    assert_eq!(std::fs::read(root.join(WORLD_FILE)).unwrap(), json_before);
    assert_eq!(std::fs::read(root.join(DB_FILE)).unwrap(), db_before);
    assert!(!backup_path(&root, 2).exists());
}

#[tokio::test]
async fn open_refuses_a_database_newer_than_its_world_json() {
    let (_dir, root) = temp_root();
    create(&root, "W", &V2).await.unwrap().close().await;
    // world.json claims v1, but the database was migrated to v2.
    let mut file = read_world_file(&root).unwrap();
    file.schema_version = 1;
    write_world_file(&root, &file).unwrap();

    let error = open(&root, &V1).await.unwrap_err();
    assert!(matches!(error, AppError::WorldTooNew(_)), "{error:?}");
}

// --- Corrupted folders ------------------------------------------------------

#[tokio::test]
async fn open_refuses_a_folder_without_world_json() {
    let (_dir, root) = temp_root();
    std::fs::create_dir_all(&root).unwrap();

    let error = open(&root, &db::MIGRATOR).await.unwrap_err();
    assert!(matches!(error, AppError::WorldInvalid(_)), "{error:?}");
}

#[tokio::test]
async fn open_refuses_an_unparsable_world_json() {
    let (_dir, root) = temp_root();
    create(&root, "W", &db::MIGRATOR)
        .await
        .unwrap()
        .close()
        .await;
    std::fs::write(root.join(WORLD_FILE), "{ truncated").unwrap();

    let error = open(&root, &db::MIGRATOR).await.unwrap_err();
    assert!(matches!(error, AppError::WorldInvalid(_)), "{error:?}");
}

#[tokio::test]
async fn open_refuses_a_foreign_json_file() {
    let (_dir, root) = temp_root();
    create(&root, "W", &db::MIGRATOR)
        .await
        .unwrap()
        .close()
        .await;
    let json = std::fs::read_to_string(root.join(WORLD_FILE)).unwrap();
    std::fs::write(
        root.join(WORLD_FILE),
        json.replace(FORMAT, "something-else"),
    )
    .unwrap();

    let error = open(&root, &db::MIGRATOR).await.unwrap_err();
    assert!(matches!(error, AppError::WorldInvalid(_)), "{error:?}");
}

#[tokio::test]
async fn open_refuses_a_missing_database() {
    let (_dir, root) = temp_root();
    create(&root, "W", &db::MIGRATOR)
        .await
        .unwrap()
        .close()
        .await;
    std::fs::remove_file(root.join(DB_FILE)).unwrap();

    let error = open(&root, &db::MIGRATOR).await.unwrap_err();
    assert!(matches!(error, AppError::WorldInvalid(_)), "{error:?}");
    assert!(
        !root.join(DB_FILE).exists(),
        "must not create an empty database"
    );
}

#[tokio::test]
async fn open_refuses_a_database_that_is_not_sqlite() {
    let (_dir, root) = temp_root();
    create(&root, "W", &db::MIGRATOR)
        .await
        .unwrap()
        .close()
        .await;
    for suffix in ["", "-wal", "-shm"] {
        let _ = std::fs::remove_file(root.join(format!("{DB_FILE}{suffix}")));
    }
    std::fs::write(root.join(DB_FILE), vec![0x42_u8; 8192]).unwrap();

    let error = open(&root, &db::MIGRATOR).await.unwrap_err();
    assert!(matches!(error, AppError::WorldInvalid(_)), "{error:?}");
}

// --- Open world swapping ----------------------------------------------------

#[tokio::test]
async fn activating_a_world_closes_the_previous_one_and_records_it() {
    use crate::commands::world::{activate, close};
    use crate::settings::AppSettings;
    use crate::state::AppState;

    let config = tempfile::tempdir().unwrap();
    let state = AppState::new(config.path().to_path_buf(), AppSettings::default());
    let (_a_dir, a_root) = temp_root();
    let (_b_dir, b_root) = temp_root();

    let a = create(&a_root, "A", &db::MIGRATOR).await.unwrap();
    let a_pool = a.pool.clone();
    activate(&state, a).await;
    let b = create(&b_root, "B", &db::MIGRATOR).await.unwrap();
    let b_pool = b.pool.clone();
    let info = activate(&state, b).await;

    assert!(a_pool.is_closed(), "previous world must be closed");
    assert_eq!(
        state.world.lock().await.as_ref().map(OpenWorld::info),
        Some(info)
    );

    let recent = crate::settings::load(config.path()).recent_worlds;
    assert_eq!(
        recent.iter().map(|w| w.name.as_str()).collect::<Vec<_>>(),
        ["B", "A"]
    );

    close(&state).await;
    assert!(b_pool.is_closed());
    assert!(state.world.lock().await.is_none());
}
