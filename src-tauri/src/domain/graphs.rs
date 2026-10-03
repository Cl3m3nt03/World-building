//! Graphs (docs/features/04-graph.md, M5): the world's cards as nodes and
//! their links (mentions, link properties, and since M7.5 the relations drawn
//! in the trees, ADR 0007) as edges, drawn by the front with a force
//! simulation. Nothing is drawn by hand: the nodes and edges come
//! from the cards and the `links` table each time. A graph document keeps
//! only its configuration (filters, settings, pinned nodes, framing).

use std::collections::{BTreeMap, HashMap, HashSet};

use serde::{Deserialize, Serialize};
use specta::Type;
use sqlx::SqlitePool;

use crate::db;
use crate::db::graphs::{self as queries, GraphRow, PinnedRow};
use crate::domain::documents::{self, DocumentKind};
use crate::domain::tree;
use crate::error::{AppError, AppResult};

/// Most filtered types, and most pinned nodes, in one graph.
pub const MAX_TYPE_FILTERS: usize = 500;
pub const MAX_PINNED: usize = 20_000;
/// Positions and framing stay within this distance of the origin.
const MAX_COORDINATE: f64 = 1.0e6;

/// Which cards the graph shows. No type: every card.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct GraphFilters {
    /// Types (or subtypes) shown; a type includes its subtypes (the front
    /// expands them).
    pub type_ids: Vec<String>,
}

/// Display and forces (the `d3-force` settings of the spec).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct GraphSettings {
    pub show_labels: bool,
    pub hide_isolated: bool,
    /// Scale of the nodes' images (1 is the default size).
    pub node_size: f64,
    /// Rest length of the edges (`forceLink.distance`).
    pub link_distance: f64,
    /// Stiffness of the edges (`forceLink.strength`).
    pub link_strength: f64,
    /// Repulsion between nodes (`forceManyBody`, as a positive number).
    pub repulsion: f64,
    /// Collision radius, as a share of a node's radius (`forceCollide`).
    pub collision: f64,
    /// Pull towards the vertical and horizontal axes (`forceX`, `forceY`).
    pub gravity_x: f64,
    pub gravity_y: f64,
}

impl Default for GraphSettings {
    fn default() -> Self {
        Self {
            show_labels: true,
            hide_isolated: false,
            node_size: 1.0,
            link_distance: 60.0,
            link_strength: 0.5,
            repulsion: 120.0,
            collision: 1.0,
            gravity_x: 0.05,
            gravity_y: 0.05,
        }
    }
}

/// Bounds of each setting (also the front's sliders).
const SETTING_RANGES: [(&str, f64, f64); 7] = [
    ("node size", 0.25, 4.0),
    ("link distance", 5.0, 500.0),
    ("link strength", 0.0, 2.0),
    ("repulsion", 0.0, 2_000.0),
    ("collision", 0.0, 3.0),
    ("gravity x", 0.0, 1.0),
    ("gravity y", 0.0, 1.0),
];

/// Framing of the view: the point at the centre and the zoom.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GraphViewport {
    pub x: f64,
    pub y: f64,
    pub zoom: f64,
}

/// A node kept in place, whatever the forces and the moves of the view.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PinnedNode {
    pub card_id: String,
    pub x: f64,
    pub y: f64,
}

/// What a graph document keeps.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GraphConfig {
    pub filters: GraphFilters,
    pub settings: GraphSettings,
    pub pinned: Vec<PinnedNode>,
    /// `null` until the graph was framed (it then fits every node).
    pub viewport: Option<GraphViewport>,
}

/// A graph as seen by the front.
#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Graph {
    pub id: String,
    pub title: String,
    pub config: GraphConfig,
}

/// A card drawn as a node.
#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GraphNode {
    pub id: String,
    pub title: String,
    pub type_id: Option<String>,
    pub image_asset_id: Option<String>,
    /// Other names of the card (the graph's search finds them too).
    pub aliases: Vec<String>,
}

/// The links between two cards, whatever their direction, as one edge.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GraphEdge {
    pub source: String,
    pub target: String,
    /// Number of links between the two cards (the edge's thickness).
    pub weight: u32,
    /// Why the two cards are linked, each reason once.
    pub reasons: Vec<EdgeReason>,
}

/// Where a link between two cards comes from.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum EdgeReason {
    /// Card `from` cites the other one in its texts, `count` times (one per
    /// text holding the mention).
    #[serde(rename_all = "camelCase")]
    Mention { from: String, count: u32 },
    /// The other card is a value of card `from`'s link property `label`
    /// (empty when the property is gone); with the relation the property
    /// carries, if any (the other card is that relation of `from`).
    #[serde(rename_all = "camelCase")]
    Property {
        from: String,
        label: String,
        relation_type_id: Option<String>,
    },
    /// A relation drawn in a tree: `from` is `relation_type_id` of `to`
    /// (« Gilraen : parent de Aragorn »); `None`: a link without a type.
    #[serde(rename_all = "camelCase")]
    Relation {
        from: String,
        to: String,
        relation_type_id: Option<String>,
        tree_id: String,
        tree_title: String,
    },
}

impl EdgeReason {
    /// How much this reason adds to the edge's weight.
    fn weight(&self) -> u32 {
        match self {
            Self::Mention { count, .. } => *count,
            Self::Property { .. } | Self::Relation { .. } => 1,
        }
    }
}

/// Everything a graph can draw: the live cards and their links.
#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GraphData {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
}

fn invalid(message: impl Into<String>) -> AppError {
    AppError::InvalidInput(message.into())
}

fn check_range(what: &str, value: f64, min: f64, max: f64) -> AppResult<()> {
    if !value.is_finite() || !(min..=max).contains(&value) {
        return Err(invalid(format!(
            "{what} must be between {min} and {max}: {value}"
        )));
    }
    Ok(())
}

fn check_coordinate(what: &str, value: f64) -> AppResult<()> {
    check_range(what, value, -MAX_COORDINATE, MAX_COORDINATE)
}

/// Checks a configuration sent by the front: bounded settings and lists,
/// finite positions, each card pinned once.
pub fn check(config: &GraphConfig) -> AppResult<()> {
    let filters = &config.filters.type_ids;
    if filters.len() > MAX_TYPE_FILTERS {
        return Err(invalid(format!(
            "a graph filters at most {MAX_TYPE_FILTERS} types"
        )));
    }
    if filters.iter().any(|id| id.is_empty() || id.len() > 100) {
        return Err(invalid("a filtered type needs an id"));
    }
    let settings = &config.settings;
    let values = [
        settings.node_size,
        settings.link_distance,
        settings.link_strength,
        settings.repulsion,
        settings.collision,
        settings.gravity_x,
        settings.gravity_y,
    ];
    for ((what, min, max), value) in SETTING_RANGES.iter().zip(values) {
        check_range(what, value, *min, *max)?;
    }
    if config.pinned.len() > MAX_PINNED {
        return Err(invalid(format!("a graph pins at most {MAX_PINNED} nodes")));
    }
    let mut seen = HashSet::new();
    for node in &config.pinned {
        if node.card_id.is_empty() || node.card_id.len() > 100 {
            return Err(invalid("a pinned node needs a card id"));
        }
        if !seen.insert(node.card_id.as_str()) {
            return Err(invalid(format!("card pinned twice: {}", node.card_id)));
        }
        check_coordinate("pinned node x", node.x)?;
        check_coordinate("pinned node y", node.y)?;
    }
    if let Some(viewport) = &config.viewport {
        check_coordinate("view x", viewport.x)?;
        check_coordinate("view y", viewport.y)?;
        check_range("zoom", viewport.zoom, 0.001, 1_000.0)?;
    }
    Ok(())
}

fn to_json<T: Serialize>(value: &T) -> AppResult<String> {
    serde_json::to_string(value).map_err(|error| AppError::Internal(format!("graph json: {error}")))
}

/// A stored JSON value, or its default when it cannot be read (a newer or
/// damaged world must still open its graphs).
fn from_json<T: for<'de> Deserialize<'de> + Default>(what: &str, json: &str) -> T {
    serde_json::from_str(json).unwrap_or_else(|error| {
        tracing::warn!(%error, what, "unreadable graph value, using the default one");
        T::default()
    })
}

async fn write_config(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    id: &str,
    config: &GraphConfig,
) -> AppResult<bool> {
    let viewport = config.viewport.as_ref().map(to_json).transpose()?;
    let found = queries::update(
        tx,
        id,
        &to_json(&config.filters)?,
        &to_json(&config.settings)?,
        viewport.as_deref(),
    )
    .await?;
    for node in &config.pinned {
        let row = PinnedRow {
            card_id: node.card_id.clone(),
            x: node.x,
            y: node.y,
        };
        queries::insert_pinned(tx, id, &row).await?;
    }
    Ok(found)
}

async fn insert_graph(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    title: &str,
    config: &GraphConfig,
) -> AppResult<String> {
    let document = documents::create_in(tx, DocumentKind::Graph, title).await?;
    let viewport = config.viewport.as_ref().map(to_json).transpose()?;
    queries::insert(
        tx,
        &document.id,
        &to_json(&config.filters)?,
        &to_json(&config.settings)?,
        viewport.as_deref(),
    )
    .await?;
    write_config(tx, &document.id, config).await?;
    Ok(document.id)
}

/// Creates a graph named `title`, showing every card with the default
/// settings.
pub async fn create(pool: &SqlitePool, title: &str) -> AppResult<Graph> {
    let mut tx = db::begin_write(pool).await?;
    let id = insert_graph(&mut tx, title, &GraphConfig::default()).await?;
    tx.commit().await?;
    get(pool, &id).await
}

pub async fn get(pool: &SqlitePool, id: &str) -> AppResult<Graph> {
    let row: GraphRow = queries::get(pool, id)
        .await?
        .ok_or_else(|| invalid(format!("graph not found: {id}")))?;
    let pinned = queries::pinned(pool, id)
        .await?
        .into_iter()
        .map(|node| PinnedNode {
            card_id: node.card_id,
            x: node.x,
            y: node.y,
        })
        .collect();
    let viewport = row
        .viewport
        .as_deref()
        .and_then(|json| serde_json::from_str::<GraphViewport>(json).ok());
    Ok(Graph {
        id: row.document_id,
        title: row.title,
        config: GraphConfig {
            filters: from_json("filters", &row.filters),
            settings: from_json("settings", &row.settings),
            pinned,
            viewport,
        },
    })
}

/// Replaces the configuration of the graph `id` with `config`, once checked.
pub async fn save(pool: &SqlitePool, id: &str, config: &GraphConfig) -> AppResult<()> {
    check(config)?;
    let mut tx = db::begin_write(pool).await?;
    if !write_config(&mut tx, id, config).await? {
        return Err(invalid(format!("graph not found: {id}")));
    }
    db::documents::touch(&mut tx, id, &documents::now()).await?;
    tx.commit().await?;
    Ok(())
}

/// Duplicates the graph `id` as `title` (same configuration), placed right
/// after it. Also « Save as… » of the spec, once its configuration is saved.
pub async fn duplicate(pool: &SqlitePool, id: &str, title: &str) -> AppResult<Graph> {
    let graph = get(pool, id).await?;
    let mut tx = db::begin_write(pool).await?;
    let copy = insert_graph(&mut tx, title, &graph.config).await?;
    tree::place_after(&mut tx, id, &copy).await?;
    tx.commit().await?;
    get(pool, &copy).await
}

/// The relations drawn between two cards in the live trees (ADR 0007):
/// `(from, to, relation type, tree id, tree title)`, once per direction and
/// type (the first tree by title wins). A child hanging from the link of a
/// couple (a junction) is related to both of them.
fn tree_relations(
    nodes: &[queries::TreeNodeRow],
    edges: &[queries::TreeEdgeRow],
) -> Vec<(String, String, Option<String>, String, String)> {
    let cards: HashMap<&str, &str> = nodes
        .iter()
        .map(|node| (node.id.as_str(), node.card_id.as_str()))
        .collect();
    let by_id: HashMap<&str, &queries::TreeEdgeRow> =
        edges.iter().map(|edge| (edge.id.as_str(), edge)).collect();
    // The cards an edge starts from: its node's card, or both ends of the
    // edge it hangs from (followed a few levels at most).
    fn ends<'a>(
        edge: &queries::TreeEdgeRow,
        cards: &HashMap<&str, &'a str>,
        by_id: &HashMap<&str, &queries::TreeEdgeRow>,
        depth: u8,
    ) -> Vec<&'a str> {
        if let Some(node) = &edge.source_node_id {
            return cards.get(node.as_str()).copied().into_iter().collect();
        }
        let Some(parent) = edge.source_edge_id.as_deref().and_then(|id| by_id.get(id)) else {
            return Vec::new();
        };
        if depth > 8 {
            return Vec::new();
        }
        let mut found = ends(parent, cards, by_id, depth + 1);
        found.extend(cards.get(parent.target_node_id.as_str()).copied());
        found
    }
    let mut seen = HashSet::new();
    let mut relations = Vec::new();
    for edge in edges {
        let Some(&to) = cards.get(edge.target_node_id.as_str()) else {
            continue;
        };
        for from in ends(edge, &cards, &by_id, 0) {
            if from == to {
                continue;
            }
            let key = (
                from.to_owned(),
                to.to_owned(),
                edge.relation_type_id.clone(),
            );
            if seen.insert(key) {
                relations.push((
                    from.to_owned(),
                    to.to_owned(),
                    edge.relation_type_id.clone(),
                    edge.tree_id.clone(),
                    edge.tree_title.clone(),
                ));
            }
        }
    }
    relations
}

/// The live cards and their links, one edge per pair of cards (whatever the
/// direction) with its reasons, and their count as its weight.
pub async fn data(pool: &SqlitePool) -> AppResult<GraphData> {
    let nodes: Vec<GraphNode> = queries::nodes(pool)
        .await?
        .into_iter()
        .map(|node| GraphNode {
            aliases: serde_json::from_str(&node.aliases).unwrap_or_default(),
            id: node.id,
            title: node.title,
            type_id: node.type_id,
            image_asset_id: node.image_asset_id,
        })
        .collect();
    let live: HashSet<&str> = nodes.iter().map(|node| node.id.as_str()).collect();
    let pair = |a: &str, b: &str| {
        if a <= b {
            (a.to_owned(), b.to_owned())
        } else {
            (b.to_owned(), a.to_owned())
        }
    };
    let mut pairs: BTreeMap<(String, String), Vec<EdgeReason>> = BTreeMap::new();
    for edge in queries::edges(pool).await? {
        let count = u32::try_from(edge.count).unwrap_or(u32::MAX);
        let reason = if edge.kind == "property" {
            EdgeReason::Property {
                from: edge.source_id.clone(),
                label: edge.label.unwrap_or_default(),
                relation_type_id: edge.relation_type_id,
            }
        } else {
            EdgeReason::Mention {
                from: edge.source_id.clone(),
                count,
            }
        };
        let reasons = pairs
            .entry(pair(&edge.source_id, &edge.target_id))
            .or_default();
        // A property linking twice (two values) is still one reason.
        if !reasons.contains(&reason) {
            reasons.push(reason);
        }
    }
    let tree_nodes = queries::tree_nodes(pool).await?;
    let tree_edges = queries::tree_edges(pool).await?;
    for (from, to, relation_type_id, tree_id, tree_title) in
        tree_relations(&tree_nodes, &tree_edges)
    {
        // A card in the trash (or deleted) draws no edge.
        if !live.contains(from.as_str()) || !live.contains(to.as_str()) {
            continue;
        }
        pairs
            .entry(pair(&from, &to))
            .or_default()
            .push(EdgeReason::Relation {
                from,
                to,
                relation_type_id,
                tree_id,
                tree_title,
            });
    }
    let edges = pairs
        .into_iter()
        .map(|((source, target), reasons)| GraphEdge {
            source,
            target,
            weight: reasons
                .iter()
                .fold(0u32, |sum, reason| sum.saturating_add(reason.weight())),
            reasons,
        })
        .collect();
    Ok(GraphData { nodes, edges })
}

#[cfg(test)]
mod tests;
