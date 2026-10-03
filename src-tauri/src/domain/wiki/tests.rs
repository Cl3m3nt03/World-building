use super::*;
use crate::db;
use crate::domain::card_types::{self, NewCardType};
use crate::domain::{cards, documents};
use crate::world;

async fn world() -> (tempfile::TempDir, crate::world::OpenWorld) {
    let dir = tempfile::tempdir().unwrap();
    let world = world::create(&dir.path().join("W"), "W", &db::MIGRATOR)
        .await
        .unwrap();
    (dir, world)
}

fn palette(accent: &str) -> WikiPalette {
    WikiPalette {
        background: "#f5efe3".into(),
        surface: "#fffaf0".into(),
        text: "#1f1a14".into(),
        muted: "#6b6155".into(),
        accent: accent.into(),
    }
}

#[tokio::test]
async fn a_new_world_has_an_empty_wiki_with_the_default_theme() {
    let (_dir, world) = world().await;
    let settings = settings(&world.pool).await.unwrap();
    assert_eq!(settings.title, "");
    assert!(settings.featured.is_empty());
    assert_eq!(settings.theme, WikiTheme::default());
    assert!(pages(&world.pool).await.unwrap().is_empty());
}

#[tokio::test]
async fn settings_read_back_the_same_and_bad_ones_are_refused() {
    let (_dir, world) = world().await;
    let saved = WikiSettings {
        title: "Les Terres du Milieu".into(),
        description: "Un monde de légendes.".into(),
        banner_asset_id: Some("abc.png".into()),
        featured: vec!["a".into(), "b".into()],
        theme: WikiTheme {
            preset: "night".into(),
            palette: Some(palette("#a8741a")),
            heading_font: Some("cinzel".into()),
            body_font: None,
            saved_palettes: vec![NamedPalette {
                name: "Ors".into(),
                palette: palette("#c8912e"),
            }],
        },
    };
    save_settings(&world.pool, &saved).await.unwrap();
    assert_eq!(settings(&world.pool).await.unwrap(), saved);

    let bad = |change: fn(&mut WikiSettings)| {
        let mut settings = saved.clone();
        change(&mut settings);
        settings
    };
    for wrong in [
        bad(|s| s.title = "x".repeat(MAX_TITLE + 1)),
        bad(|s| s.featured = vec!["a".into(), "a".into()]),
        bad(|s| s.theme.palette = Some(palette("red"))),
        bad(|s| s.theme.preset = "../x".into()),
        bad(|s| s.theme.saved_palettes[0].name = "  ".into()),
    ] {
        assert!(save_settings(&world.pool, &wrong).await.is_err());
    }
}

#[tokio::test]
async fn an_unreadable_theme_falls_back_to_the_default() {
    let (_dir, world) = world().await;
    sqlx::query("UPDATE wiki_settings SET theme = '{\"preset\": \"night\", \"future\": 1}'")
        .execute(&world.pool)
        .await
        .unwrap();
    assert_eq!(settings(&world.pool).await.unwrap().theme.preset, "night");
    sqlx::query("UPDATE wiki_settings SET theme = 'not json'")
        .execute(&world.pool)
        .await
        .unwrap();
    assert_eq!(
        settings(&world.pool).await.unwrap().theme,
        WikiTheme::default()
    );
}

#[tokio::test]
async fn only_visible_live_cards_and_maps_are_pages() {
    let (_dir, world) = world().await;
    let pool = &world.pool;
    let character = card_types::create(
        pool,
        NewCardType {
            parent_id: None,
            name: "Personnage".into(),
            icon: "user".into(),
            color: "blue".into(),
        },
    )
    .await
    .unwrap()
    .id;
    let aragorn = cards::create(pool, &character, "Aragorn").await.unwrap().id;
    let gandalf = cards::create(pool, &character, "Gandalf").await.unwrap().id;
    cards::set_aliases(pool, &aragorn, &["Grands-Pas".to_owned()])
        .await
        .unwrap();
    let graph = crate::domain::graphs::create(pool, "Liens").await.unwrap();

    set_visible(pool, &aragorn, true).await.unwrap();
    set_visible(pool, &gandalf, true).await.unwrap();
    // A graph has no page.
    assert!(set_visible(pool, &graph.id, true).await.is_err());
    assert!(set_visible(pool, "missing", true).await.is_err());

    let shown = pages(pool).await.unwrap();
    assert_eq!(
        shown.iter().map(|p| p.title.as_str()).collect::<Vec<_>>(),
        ["Aragorn", "Gandalf"]
    );
    assert_eq!(shown[0].kind, DocumentKind::Card);
    assert_eq!(shown[0].aliases, ["Grands-Pas"]);
    assert_eq!(shown[0].type_id.as_deref(), Some(character.as_str()));

    // Hidden again, or in the trash: no page.
    set_visible(pool, &gandalf, false).await.unwrap();
    documents::trash(pool, &aragorn).await.unwrap();
    assert!(pages(pool).await.unwrap().is_empty());
}

#[tokio::test]
async fn the_banner_is_a_usage_of_its_asset() {
    let (_dir, world) = world().await;
    let mut settings = settings(&world.pool).await.unwrap();
    settings.banner_asset_id = Some("banner.png".into());
    save_settings(&world.pool, &settings).await.unwrap();
    let usages = crate::domain::media::card_usages(&world.pool, "banner.png")
        .await
        .unwrap();
    assert!(usages.contains(&crate::domain::media::AssetUsage::WikiBanner));
}
