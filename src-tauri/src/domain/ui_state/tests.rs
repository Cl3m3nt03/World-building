//! Interface state tests, on a real world (real migrations) in a temp folder.

use super::*;
use crate::db;
use crate::world::{self, OpenWorld};

async fn world() -> (tempfile::TempDir, OpenWorld) {
    let dir = tempfile::tempdir().unwrap();
    let world = world::create(&dir.path().join("W"), "W", &db::MIGRATOR)
        .await
        .unwrap();
    (dir, world)
}

#[tokio::test]
async fn a_new_world_has_the_default_sidebar() {
    let (_dir, world) = world().await;
    assert_eq!(sidebar(&world.pool).await.unwrap(), SidebarState::default());
}

#[tokio::test]
async fn the_sidebar_state_is_saved_and_bounded() {
    let (_dir, world) = world().await;
    let state = SidebarState {
        width: Some(9_999),
        collapsed: true,
        expanded: vec!["f:a".into(), "d:b".into()],
        view: SidebarView {
            kinds: vec![DocumentKind::Card],
            type_ids: vec!["character".into()],
            sort: SortBy::Name,
            reversed: true,
            wiki_only: true,
        },
    };

    let saved = set_sidebar(&world.pool, state.clone()).await.unwrap();

    assert_eq!(saved.width, Some(SIDEBAR_MAX_WIDTH));
    assert_eq!(
        sidebar(&world.pool).await.unwrap(),
        SidebarState {
            width: Some(SIDEBAR_MAX_WIDTH),
            ..state
        }
    );
}

#[tokio::test]
async fn an_unreadable_or_partial_state_is_read_tolerantly() {
    let (_dir, world) = world().await;
    queries::set(&world.pool, SIDEBAR_KEY, "not json")
        .await
        .unwrap();
    assert_eq!(sidebar(&world.pool).await.unwrap(), SidebarState::default());

    // A state from an older or newer app: missing and unknown fields.
    queries::set(
        &world.pool,
        SIDEBAR_KEY,
        r#"{"width":300,"future":1,"view":{"sort":"name"}}"#,
    )
    .await
    .unwrap();
    let state = sidebar(&world.pool).await.unwrap();
    assert_eq!(state.width, Some(300));
    assert_eq!(state.view.sort, SortBy::Name);
    assert!(state.expanded.is_empty());
}
