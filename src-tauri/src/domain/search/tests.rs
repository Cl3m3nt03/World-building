//! Search tests, on a real world (real migrations) in a temp folder.

use super::*;
use crate::db;
use crate::domain::card_types::{self, NewCardType};
use crate::domain::{cards, documents};
use crate::world::{self, OpenWorld};

struct Fixture {
    _dir: tempfile::TempDir,
    world: OpenWorld,
    type_id: String,
}

impl Fixture {
    async fn new() -> Self {
        let dir = tempfile::tempdir().unwrap();
        let world = world::create(&dir.path().join("W"), "W", &db::MIGRATOR)
            .await
            .unwrap();
        let type_id = card_types::create(
            &world.pool,
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
        Self {
            _dir: dir,
            world,
            type_id,
        }
    }

    fn pool(&self) -> &SqlitePool {
        &self.world.pool
    }

    async fn card(&self, title: &str) -> String {
        cards::create(self.pool(), &self.type_id, title)
            .await
            .unwrap()
            .id
    }

    async fn text(&self, id: &str, text: &str) {
        let json =
            serde_json::json!([{ "id": "b", "type": "text", "doc": { "type": "doc", "content": [
            { "type": "paragraph", "content": [{ "type": "text", "text": text }] }
        ] } }])
            .to_string();
        cards::set_content(self.pool(), id, &json).await.unwrap();
    }

    /// Each hit as "title (how)", with [matched] words.
    async fn find(&self, query: &str) -> Vec<String> {
        let show = |parts: &[TextPart]| {
            parts
                .iter()
                .map(|p| {
                    if p.matched {
                        format!("[{}]", p.text)
                    } else {
                        p.text.clone()
                    }
                })
                .collect::<String>()
        };
        search(self.pool(), query)
            .await
            .unwrap()
            .iter()
            .map(|hit| match &hit.matched {
                SearchMatch::Name => show(&hit.title),
                SearchMatch::Alias { alias } => {
                    format!("{} (alias {})", show(&hit.title), show(alias))
                }
                SearchMatch::Content { excerpt } => {
                    format!("{} (contenu {})", show(&hit.title), show(excerpt))
                }
            })
            .collect()
    }
}

#[tokio::test]
async fn finds_by_name_prefix_ignoring_accents_and_case() {
    let fx = Fixture::new().await;
    fx.card("Éowyn").await;
    fx.card("Elrond").await;
    fx.card("Aragorn").await;

    assert_eq!(fx.find("eow").await, ["[Éowyn]"]);
    assert_eq!(fx.find("EL").await, ["[Elrond]"]);
    assert!(fx.find("zzz").await.is_empty());
    // Nothing searchable typed: nothing found, no error.
    assert!(fx.find("  \" - ").await.is_empty());
}

#[tokio::test]
async fn names_and_aliases_come_before_content_with_an_excerpt() {
    let fx = Fixture::new().await;
    let aragorn = fx.card("Aragorn").await;
    cards::set_aliases(
        fx.pool(),
        &aragorn,
        &["Grands-Pas".to_owned(), "Elessar".to_owned()],
    )
    .await
    .unwrap();
    let gondor = fx.card("Gondor").await;
    fx.text(
        &gondor,
        "Le royaume des hommes, dont Elessar devient le roi.",
    )
    .await;
    fx.card("Elessar le Grand").await;

    assert_eq!(
        fx.find("elessar").await,
        [
            "[Elessar] le Grand",
            "Aragorn (alias [Elessar])",
            "Gondor (contenu Le royaume des hommes, dont [Elessar] devient le roi.)",
        ]
    );
    assert_eq!(fx.find("grands").await, ["Aragorn (alias [Grands]-Pas)"]);
}

#[tokio::test]
async fn every_word_must_match() {
    let fx = Fixture::new().await;
    let gondor = fx.card("Gondor").await;
    fx.text(&gondor, "La cité blanche de Minas Tirith.").await;
    let rohan = fx.card("Rohan").await;
    fx.text(&rohan, "Les plaines du Rohan, pas de cité.").await;

    assert_eq!(fx.find("cite blanc").await.len(), 1);
    assert_eq!(fx.find("cite").await.len(), 2);
}

#[tokio::test]
async fn the_index_follows_renames_content_trash_and_deletion() {
    let fx = Fixture::new().await;
    let id = fx.card("Brouillon").await;
    fx.text(&id, "Une ancienne forteresse").await;

    documents::rename(fx.pool(), &id, "Orthanc").await.unwrap();
    assert_eq!(fx.find("orthanc").await, ["[Orthanc]"]);
    assert!(fx.find("brouillon").await.is_empty());

    fx.text(&id, "Une tour noire").await;
    assert!(fx.find("forteresse").await.is_empty());
    assert_eq!(fx.find("noire").await.len(), 1);

    documents::trash(fx.pool(), &id).await.unwrap();
    assert!(fx.find("orthanc").await.is_empty());
    documents::restore(fx.pool(), &id).await.unwrap();
    assert_eq!(fx.find("orthanc").await.len(), 1);

    documents::trash(fx.pool(), &id).await.unwrap();
    documents::delete_forever(fx.pool(), &id).await.unwrap();
    let left: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM search")
        .fetch_one(fx.pool())
        .await
        .unwrap();
    assert_eq!(left, 0);
}

#[tokio::test]
async fn five_thousand_cards_are_searched_quickly() {
    let fx = Fixture::new().await;
    let mut tx = db::begin_write(fx.pool()).await.unwrap();
    for n in 0..5000 {
        let id = format!("id-{n}");
        sqlx::query(
            "INSERT INTO documents (id, kind, title, created_at, updated_at) VALUES (?, 'card', ?, '2026-10-01', '2026-10-01')",
        )
        .bind(&id)
        .bind(format!("Figurant {n}"))
        .execute(&mut *tx)
        .await
        .unwrap();
        sqlx::query("INSERT INTO cards (document_id, content_text) VALUES (?, ?)")
            .bind(&id)
            .bind(format!("Un soldat de la garde numéro {n}, né à Bree."))
            .execute(&mut *tx)
            .await
            .unwrap();
    }
    tx.commit().await.unwrap();
    let rare = fx.card("Gandalf").await;
    cards::set_aliases(fx.pool(), &rare, &["Mithrandir".to_owned()])
        .await
        .unwrap();

    let started = std::time::Instant::now();
    let by_alias = search(fx.pool(), "mithr").await.unwrap();
    let by_content = search(fx.pool(), "bree").await.unwrap();
    let elapsed = started.elapsed();

    assert_eq!(by_alias.len(), 1);
    assert_eq!(by_content.len(), 30);
    // Two searches; a debug build of SQLite is slower than the app's.
    assert!(elapsed.as_millis() < 200, "two searches took {elapsed:?}");
}

#[tokio::test]
async fn a_world_made_before_the_search_is_indexed_when_opened() {
    let dir = tempfile::tempdir().unwrap();
    // The migrations before this one (schema 7), from a copy of their files.
    let migrations = dir.path().join("migrations");
    std::fs::create_dir_all(&migrations).unwrap();
    let source = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("migrations");
    for entry in std::fs::read_dir(&source).unwrap() {
        let path = entry.unwrap().path();
        let name = path.file_name().unwrap().to_string_lossy().into_owned();
        let version: u32 = name.split('_').next().unwrap().parse().unwrap();
        if version <= 7 {
            std::fs::copy(&path, migrations.join(&name)).unwrap();
        }
    }
    let old = sqlx::migrate::Migrator::new(migrations.as_path())
        .await
        .unwrap();
    let root = dir.path().join("Ancien");
    let world = world::create(&root, "Ancien", &old).await.unwrap();
    sqlx::query(
        "INSERT INTO documents (id, kind, title, created_at, updated_at) VALUES ('a', 'card', 'Aragorn', 'x', 'x')",
    )
    .execute(&world.pool)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO cards (document_id, aliases, content_text) VALUES ('a', '[\"Grands-Pas\"]', 'Héritier d''Isildur')",
    )
    .execute(&world.pool)
    .await
    .unwrap();
    world.close().await;

    let reopened = world::open(&root, &db::MIGRATOR).await.unwrap();
    let ids = |hits: Vec<SearchHit>| hits.into_iter().map(|hit| hit.id).collect::<Vec<_>>();
    assert_eq!(ids(search(&reopened.pool, "aragorn").await.unwrap()), ["a"]);
    assert_eq!(ids(search(&reopened.pool, "grands").await.unwrap()), ["a"]);
    assert_eq!(
        ids(search(&reopened.pool, "heritier").await.unwrap()),
        ["a"]
    );
    reopened.close().await;
}
