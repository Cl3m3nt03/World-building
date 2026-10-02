use super::*;
use crate::world::{self, OpenWorld};

struct Fixture {
    _dir: tempfile::TempDir,
    world: OpenWorld,
}

impl Fixture {
    async fn new() -> Self {
        let dir = tempfile::tempdir().unwrap();
        let world = world::create(&dir.path().join("W"), "W", &db::MIGRATOR)
            .await
            .unwrap();
        Self { _dir: dir, world }
    }

    fn pool(&self) -> &SqlitePool {
        &self.world.pool
    }
}

fn node(id: &str, label: &str, x: f64) -> TreeNode {
    TreeNode {
        id: id.into(),
        card_id: None,
        label: label.into(),
        x,
        y: 0.0,
    }
}

fn edge(id: &str, source: EdgeSource, target: &str, kind: Option<&str>) -> TreeEdge {
    TreeEdge {
        id: id.into(),
        source,
        target: target.into(),
        relation_type_id: kind.map(str::to_owned),
        line_style: LineStyle::Solid,
    }
}

/// A couple, Aragorn and Arwen, and their son Eldarion on the couple's link.
fn family() -> VariantContent {
    VariantContent {
        nodes: vec![
            node("aragorn", "Aragorn", 0.0),
            node("arwen", "Arwen", 200.0),
            node("eldarion", "Eldarion", 100.0),
        ],
        edges: vec![
            // The junction first: it is stored after its source edge anyway.
            edge(
                "child",
                EdgeSource::Edge("couple".into()),
                "eldarion",
                Some("rel-child"),
            ),
            TreeEdge {
                line_style: LineStyle::Dashed,
                ..edge(
                    "couple",
                    EdgeSource::Node("aragorn".into()),
                    "arwen",
                    Some("rel-spouse"),
                )
            },
        ],
        annotations: vec![
            TreeAnnotation::Drawing {
                id: "stroke".into(),
                points: vec![[0.0, 0.0], [10.0, 5.0], [20.0, 0.0]],
                color: "red".into(),
                width: 2.0,
            },
            TreeAnnotation::Text {
                id: "note".into(),
                x: 50.0,
                y: -40.0,
                text: "Quatrième âge".into(),
                color: "slate".into(),
                size: 16.0,
            },
        ],
    }
}

#[tokio::test]
async fn a_new_tree_has_one_variant_with_an_empty_node() {
    let fx = Fixture::new().await;
    let tree = create(fx.pool(), "Arbre sans nom", "Variante 1")
        .await
        .unwrap();
    assert_eq!(tree.title, "Arbre sans nom");
    assert_eq!(tree.variants.len(), 1);
    let first = &tree.variants[0];
    assert_eq!(first.name, "Variante 1");
    assert_eq!(first.content.nodes.len(), 1);
    assert_eq!(first.content.nodes[0].card_id, None);
    assert_eq!(first.content.nodes[0].label, "");
    assert!(first.content.edges.is_empty());
}

#[tokio::test]
async fn a_variant_and_its_junction_read_back_the_same() {
    let fx = Fixture::new().await;
    let tree = create(fx.pool(), "Famille", "Tome 1").await.unwrap();
    let variant = &tree.variants[0].id;

    save_variant(fx.pool(), variant, &family()).await.unwrap();

    let read = get(fx.pool(), &tree.id).await.unwrap().variants[0]
        .content
        .clone();
    assert_eq!(read.nodes, family().nodes);
    // Stored source first, then the junction.
    assert_eq!(read.edges[0].id, "couple");
    assert_eq!(read.edges[0].line_style, LineStyle::Dashed);
    assert_eq!(read.edges[1].source, EdgeSource::Edge("couple".into()));
    assert_eq!(read.annotations, family().annotations);
}

#[tokio::test]
async fn bad_contents_are_refused() {
    let fx = Fixture::new().await;
    let tree = create(fx.pool(), "T", "V").await.unwrap();
    let variant = &tree.variants[0].id;
    let base = family();

    let mut looped = base.clone();
    looped.edges.push(edge(
        "self",
        EdgeSource::Node("arwen".into()),
        "arwen",
        None,
    ));
    assert!(save_variant(fx.pool(), variant, &looped).await.is_err());

    let mut unknown = base.clone();
    unknown
        .edges
        .push(edge("e", EdgeSource::Node("ghost".into()), "arwen", None));
    assert!(save_variant(fx.pool(), variant, &unknown).await.is_err());

    let mut cycle = base.clone();
    cycle.edges = vec![
        edge("a", EdgeSource::Edge("b".into()), "arwen", None),
        edge("b", EdgeSource::Edge("a".into()), "aragorn", None),
    ];
    assert!(save_variant(fx.pool(), variant, &cycle).await.is_err());

    let mut typed = base.clone();
    typed.edges[1].relation_type_id = Some("rel-unknown".into());
    assert!(save_variant(fx.pool(), variant, &typed).await.is_err());

    let mut twice = base;
    twice.nodes.push(node("arwen", "Arwen bis", 0.0));
    assert!(save_variant(fx.pool(), variant, &twice).await.is_err());
}

#[tokio::test]
async fn variants_are_copied_renamed_moved_and_deleted_on_their_own() {
    let fx = Fixture::new().await;
    let tree = create(fx.pool(), "Famille", "Tome 1").await.unwrap();
    let first = tree.variants[0].id.clone();
    save_variant(fx.pool(), &first, &family()).await.unwrap();

    let tree = add_variant(fx.pool(), &first, "Après la guerre")
        .await
        .unwrap();
    assert_eq!(
        tree.variants
            .iter()
            .map(|v| v.name.as_str())
            .collect::<Vec<_>>(),
        ["Tome 1", "Après la guerre"]
    );
    let second = tree.variants[1].clone();
    assert_eq!(second.content.nodes.len(), 3);
    assert_ne!(second.content.nodes[0].id, "aragorn");

    // Changing the copy leaves the original alone.
    let mut changed = second.content.clone();
    changed.nodes.truncate(1);
    changed.edges.clear();
    save_variant(fx.pool(), &second.id, &changed).await.unwrap();
    let tree = get(fx.pool(), &tree.id).await.unwrap();
    assert_eq!(tree.variants[0].content.nodes.len(), 3);
    assert_eq!(tree.variants[1].content.nodes.len(), 1);

    rename_variant(fx.pool(), &second.id, "Tome 2")
        .await
        .unwrap();
    move_variant(fx.pool(), &second.id, 0).await.unwrap();
    let tree = get(fx.pool(), &tree.id).await.unwrap();
    assert_eq!(
        tree.variants
            .iter()
            .map(|v| v.name.as_str())
            .collect::<Vec<_>>(),
        ["Tome 2", "Tome 1"]
    );

    delete_variant(fx.pool(), &second.id).await.unwrap();
    assert!(delete_variant(fx.pool(), &first).await.is_err());
    assert_eq!(get(fx.pool(), &tree.id).await.unwrap().variants.len(), 1);
}

#[tokio::test]
async fn a_tree_is_duplicated_trashed_and_deleted_like_a_document() {
    let fx = Fixture::new().await;
    let tree = create(fx.pool(), "Famille", "Tome 1").await.unwrap();
    save_variant(fx.pool(), &tree.variants[0].id, &family())
        .await
        .unwrap();
    add_variant(fx.pool(), &tree.variants[0].id, "Tome 2")
        .await
        .unwrap();

    let copy = duplicate(fx.pool(), &tree.id, "Famille (copie)")
        .await
        .unwrap();
    assert_eq!(copy.variants.len(), 2);
    assert_eq!(copy.variants[0].content.edges.len(), 2);
    assert_ne!(copy.variants[0].id, tree.variants[0].id);
    // The junction follows its source's new id.
    let source = copy.variants[0].content.edges[0].id.clone();
    assert_eq!(
        copy.variants[0].content.edges[1].source,
        EdgeSource::Edge(source)
    );

    documents::trash(fx.pool(), &tree.id).await.unwrap();
    assert_eq!(get(fx.pool(), &tree.id).await.unwrap().variants.len(), 2);
    documents::delete_forever(fx.pool(), &tree.id)
        .await
        .unwrap();
    assert!(get(fx.pool(), &tree.id).await.is_err());
    let left: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM tree_nodes")
        .fetch_one(fx.pool())
        .await
        .unwrap();
    // Only the copy is left: two variants of three nodes.
    assert_eq!(left, 6);
}

#[tokio::test]
async fn relation_types_provided_and_of_the_world() {
    let fx = Fixture::new().await;
    let provided = relation_types(fx.pool()).await.unwrap();
    let keys: Vec<_> = provided
        .iter()
        .filter_map(|t| t.builtin.as_deref())
        .collect();
    assert_eq!(keys, ["parent", "child", "sibling", "partner", "spouse"]);
    let parent = provided.iter().find(|t| t.id == "rel-parent").unwrap();
    assert_eq!(parent.inverse_id.as_deref(), Some("rel-child"));

    let mentor = create_relation_type(
        fx.pool(),
        &RelationTypeInput {
            name: "Mentor".into(),
            icon: "graduation-cap".into(),
            category: RelationCategory::Custom,
            inverse_id: None,
            symmetric: false,
        },
    )
    .await
    .unwrap();
    let student = create_relation_type(
        fx.pool(),
        &RelationTypeInput {
            name: "Élève".into(),
            icon: "book-open".into(),
            category: RelationCategory::Custom,
            inverse_id: Some(mentor.id.clone()),
            symmetric: false,
        },
    )
    .await
    .unwrap();
    let all = relation_types(fx.pool()).await.unwrap();
    let mentor = all.iter().find(|t| t.id == mentor.id).unwrap();
    assert_eq!(mentor.inverse_id.as_deref(), Some(student.id.as_str()));

    // Used in a tree, then deleted: the edge has no type any more.
    let tree = create(fx.pool(), "T", "V").await.unwrap();
    let mut content = family();
    content.edges[1].relation_type_id = Some(mentor.id.clone());
    save_variant(fx.pool(), &tree.variants[0].id, &content)
        .await
        .unwrap();
    assert_eq!(relation_type_uses(fx.pool(), &mentor.id).await.unwrap(), 1);
    delete_relation_type(fx.pool(), &mentor.id).await.unwrap();
    let read = get(fx.pool(), &tree.id).await.unwrap();
    let couple = read.variants[0]
        .content
        .edges
        .iter()
        .find(|e| e.id == "couple")
        .unwrap();
    assert_eq!(couple.relation_type_id, None);
    let student = relation_types(fx.pool())
        .await
        .unwrap()
        .into_iter()
        .find(|t| t.id == student.id)
        .unwrap();
    assert_eq!(student.inverse_id, None);

    // Provided types stay as they are.
    assert!(delete_relation_type(fx.pool(), "rel-parent").await.is_err());
}
