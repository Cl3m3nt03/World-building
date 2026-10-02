use super::*;
use crate::domain::card_types::{self, NewCardType};
use crate::domain::cards;
use crate::domain::links::{self, LinkKind};
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

    async fn link(&self, source: &str, kind: LinkKind, detail: Option<&str>, targets: &[&str]) {
        let targets: Vec<String> = targets.iter().map(|t| (*t).to_owned()).collect();
        links::replace(self.pool(), source, kind, detail, &targets)
            .await
            .unwrap();
    }
}

fn config(pinned: Vec<PinnedNode>) -> GraphConfig {
    GraphConfig {
        filters: GraphFilters {
            type_ids: vec!["character".into()],
        },
        settings: GraphSettings {
            show_labels: false,
            hide_isolated: true,
            node_size: 1.5,
            link_distance: 120.0,
            link_strength: 0.8,
            repulsion: 300.0,
            collision: 1.2,
            gravity_x: 0.1,
            gravity_y: 0.0,
        },
        pinned,
        viewport: Some(GraphViewport {
            x: 12.5,
            y: -40.0,
            zoom: 1.75,
        }),
    }
}

#[tokio::test]
async fn a_new_graph_has_the_default_configuration() {
    let fx = Fixture::new().await;
    let graph = create(fx.pool(), "Graph sans nom").await.unwrap();
    assert_eq!(graph.title, "Graph sans nom");
    assert_eq!(graph.config, GraphConfig::default());
    assert!(graph.config.settings.show_labels);
    assert_eq!(graph.config.viewport, None);
    let tree = crate::domain::tree::tree(fx.pool()).await.unwrap();
    assert!(
        tree.documents
            .iter()
            .any(|d| d.id == graph.id && d.kind == DocumentKind::Graph)
    );
}

#[tokio::test]
async fn a_saved_configuration_reads_back_the_same() {
    let fx = Fixture::new().await;
    let aragorn = fx.card("Aragorn").await;
    let arwen = fx.card("Arwen").await;
    let graph = create(fx.pool(), "Famille").await.unwrap();
    let mut pinned = vec![
        PinnedNode {
            card_id: aragorn,
            x: -10.0,
            y: 20.0,
        },
        PinnedNode {
            card_id: arwen,
            x: 30.5,
            y: 0.0,
        },
    ];
    pinned.sort_by(|a, b| a.card_id.cmp(&b.card_id));
    let saved = config(pinned);

    save(fx.pool(), &graph.id, &saved).await.unwrap();

    assert_eq!(get(fx.pool(), &graph.id).await.unwrap().config, saved);
    // Saving again replaces the pinned nodes.
    save(fx.pool(), &graph.id, &GraphConfig::default())
        .await
        .unwrap();
    assert_eq!(
        get(fx.pool(), &graph.id).await.unwrap().config,
        GraphConfig::default()
    );
}

#[tokio::test]
async fn bad_configurations_are_refused() {
    let fx = Fixture::new().await;
    let graph = create(fx.pool(), "G").await.unwrap();
    let mut bad = GraphConfig::default();
    bad.settings.repulsion = 5_000.0;
    assert!(save(fx.pool(), &graph.id, &bad).await.is_err());
    let mut bad = GraphConfig::default();
    bad.settings.node_size = f64::NAN;
    assert!(save(fx.pool(), &graph.id, &bad).await.is_err());
    let twice = PinnedNode {
        card_id: "c".into(),
        x: 0.0,
        y: 0.0,
    };
    let bad = config(vec![twice.clone(), twice]);
    assert!(save(fx.pool(), &graph.id, &bad).await.is_err());
    let bad = GraphConfig {
        viewport: Some(GraphViewport {
            x: 0.0,
            y: 0.0,
            zoom: 0.0,
        }),
        ..GraphConfig::default()
    };
    assert!(save(fx.pool(), &graph.id, &bad).await.is_err());
    assert!(
        save(fx.pool(), "missing", &GraphConfig::default())
            .await
            .is_err()
    );
}

#[tokio::test]
async fn unreadable_settings_fall_back_to_the_defaults() {
    let fx = Fixture::new().await;
    let graph = create(fx.pool(), "G").await.unwrap();
    // A newer version wrote a field we do not know, and dropped one.
    sqlx::query(
        "UPDATE graphs SET settings = '{\"repulsion\": 400, \"futureSetting\": 1}',
                           filters = 'not json' WHERE document_id = ?",
    )
    .bind(&graph.id)
    .execute(fx.pool())
    .await
    .unwrap();

    let config = get(fx.pool(), &graph.id).await.unwrap().config;

    assert_eq!(config.settings.repulsion, 400.0);
    assert_eq!(config.settings.link_distance, 60.0);
    assert_eq!(config.filters, GraphFilters::default());
}

#[tokio::test]
async fn the_data_merges_the_links_between_two_cards_into_one_edge() {
    let fx = Fixture::new().await;
    let aragorn = fx.card("Aragorn").await;
    let arwen = fx.card("Arwen").await;
    let gimli = fx.card("Gimli").await;
    let gollum = fx.card("Gollum").await;
    let alone = fx.card("Tom Bombadil").await;
    cards::set_aliases(fx.pool(), &aragorn, &["Grands-Pas".to_owned()])
        .await
        .unwrap();
    // Aragorn cites Arwen in a text, Arwen has Aragorn as a link property:
    // one edge of weight 2. Aragorn also cites Gimli, and a card in the trash.
    fx.link(
        &aragorn,
        LinkKind::Mention,
        None,
        &[&arwen, &gimli, &gollum],
    )
    .await;
    fx.link(&arwen, LinkKind::Property, Some("spouse"), &[&aragorn])
        .await;
    documents::trash(fx.pool(), &gollum).await.unwrap();
    // A map pin is not a link between cards.
    fx.link(&gimli, LinkKind::MapPin, None, &[&arwen]).await;

    let data = data(fx.pool()).await.unwrap();

    let titles: Vec<&str> = data.nodes.iter().map(|n| n.title.as_str()).collect();
    assert_eq!(titles, ["Aragorn", "Arwen", "Gimli", "Tom Bombadil"]);
    assert_eq!(data.nodes[0].aliases, ["Grands-Pas"]);
    assert!(
        data.nodes
            .iter()
            .all(|n| n.type_id.as_deref() == Some(fx.type_id.as_str()))
    );
    let pair = |a: &str, b: &str| {
        if a <= b {
            (a.to_owned(), b.to_owned())
        } else {
            (b.to_owned(), a.to_owned())
        }
    };
    let mut edges: Vec<((String, String), u32)> = data
        .edges
        .iter()
        .map(|e| ((e.source.clone(), e.target.clone()), e.weight))
        .collect();
    edges.sort();
    let mut expected = vec![(pair(&aragorn, &arwen), 2), (pair(&aragorn, &gimli), 1)];
    expected.sort();
    assert_eq!(edges, expected);
    assert!(
        !data
            .edges
            .iter()
            .any(|e| e.source == alone || e.target == alone)
    );
}

#[tokio::test]
async fn a_graph_is_duplicated_trashed_and_deleted_like_a_document() {
    let fx = Fixture::new().await;
    let aragorn = fx.card("Aragorn").await;
    let graph = create(fx.pool(), "Royaume").await.unwrap();
    let saved = config(vec![PinnedNode {
        card_id: aragorn,
        x: 1.0,
        y: 2.0,
    }]);
    save(fx.pool(), &graph.id, &saved).await.unwrap();

    let copy = duplicate(fx.pool(), &graph.id, "Royaume (copie)")
        .await
        .unwrap();
    assert_ne!(copy.id, graph.id);
    assert_eq!(copy.title, "Royaume (copie)");
    assert_eq!(copy.config, saved);

    documents::trash(fx.pool(), &graph.id).await.unwrap();
    assert_eq!(get(fx.pool(), &graph.id).await.unwrap().config, saved);
    documents::delete_forever(fx.pool(), &graph.id)
        .await
        .unwrap();
    assert!(get(fx.pool(), &graph.id).await.is_err());
    let left: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM graph_pinned_nodes WHERE graph_id = ?")
            .bind(&graph.id)
            .fetch_one(fx.pool())
            .await
            .unwrap();
    assert_eq!(left, 0);
}
