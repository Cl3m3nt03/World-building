//! Relation trees (docs/features/05-relation-tree.md, M6): trees drawn by
//! hand, each with named variants. A variant holds nodes (a card, a plain
//! name, or empty), edges (from a node or from another edge: a junction,
//! to a node, with a relation type and a line style) and annotations
//! (drawings and texts). The front owns the editing and sends a variant's
//! whole content at each save; this module checks it and stores it in one
//! transaction. Relation types are shared by the world's trees.

use std::collections::{HashMap, HashSet};

use serde::{Deserialize, Serialize};
use specta::Type;
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::db;
use crate::db::trees::{self as queries, AnnotationRow, EdgeRow, NodeRow, RelationTypeRow};
use crate::domain::documents::{self, DocumentKind};
use crate::domain::tree;
use crate::error::{AppError, AppResult};

/// Most nodes, edges and annotations in one variant.
pub const MAX_ITEMS: usize = 5_000;
/// Most variants of a tree, and most points of a drawing.
pub const MAX_VARIANTS: usize = 100;
pub const MAX_POINTS: usize = 10_000;
/// Longest name, label or text, in characters.
pub const MAX_TEXT_LEN: usize = 1_000;
const MAX_SHORT_LEN: usize = 100;
/// Positions stay within this distance of the origin.
const MAX_COORDINATE: f64 = 1.0e6;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum RelationCategory {
    Family,
    Couple,
    Other,
    Custom,
}

impl RelationCategory {
    fn as_str(self) -> &'static str {
        match self {
            Self::Family => "family",
            Self::Couple => "couple",
            Self::Other => "other",
            Self::Custom => "custom",
        }
    }

    fn parse(value: &str) -> Self {
        match value {
            "family" => Self::Family,
            "couple" => Self::Couple,
            "other" => Self::Other,
            _ => Self::Custom,
        }
    }
}

/// A kind of relation, shared by the world's trees.
#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RelationType {
    pub id: String,
    /// Key of a provided type ("parent", "child", "sibling",
    /// "half-sibling", "adopted", "adoptive-parent", "step-parent",
    /// "step-child", "partner", "spouse", "ex"), translated by the front;
    /// `null` for a type of the world.
    pub builtin: Option<String>,
    /// Name of a type of the world (empty for a provided one).
    pub name: String,
    pub icon: String,
    /// The relation the other way round; itself when symmetric.
    pub inverse_id: Option<String>,
    pub category: RelationCategory,
}

/// A new or changed type of the world.
#[derive(Debug, Clone, PartialEq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RelationTypeInput {
    pub name: String,
    pub icon: String,
    pub category: RelationCategory,
    /// The relation the other way round (kept both ways); `None`: none.
    pub inverse_id: Option<String>,
    /// The relation is its own inverse (siblings, friends).
    pub symmetric: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct TreeNode {
    pub id: String,
    /// The card the node stands for; `null` for a plain name or an empty node.
    pub card_id: Option<String>,
    /// The plain name (empty for a card or an empty node).
    pub label: String,
    pub x: f64,
    pub y: f64,
}

/// Where an edge starts: a node, or another edge (a junction).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(tag = "kind", content = "id", rename_all = "camelCase")]
pub enum EdgeSource {
    Node(String),
    Edge(String),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum LineStyle {
    Solid,
    Dashed,
    Dotted,
}

impl LineStyle {
    fn as_str(self) -> &'static str {
        match self {
            Self::Solid => "solid",
            Self::Dashed => "dashed",
            Self::Dotted => "dotted",
        }
    }

    fn parse(value: &str) -> Self {
        match value {
            "dashed" => Self::Dashed,
            "dotted" => Self::Dotted,
            _ => Self::Solid,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct TreeEdge {
    pub id: String,
    pub source: EdgeSource,
    pub target: String,
    /// `null`: a link without a type yet (« skip for now »).
    pub relation_type_id: Option<String>,
    pub line_style: LineStyle,
}

/// Something drawn over the tree.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum TreeAnnotation {
    /// A free-hand stroke.
    #[serde(rename_all = "camelCase")]
    Drawing {
        id: String,
        points: Vec<[f64; 2]>,
        color: String,
        width: f64,
    },
    /// A free text.
    #[serde(rename_all = "camelCase")]
    Text {
        id: String,
        x: f64,
        y: f64,
        text: String,
        color: String,
        size: f64,
    },
}

impl TreeAnnotation {
    fn id(&self) -> &str {
        match self {
            Self::Drawing { id, .. } | Self::Text { id, .. } => id,
        }
    }
}

/// What a variant holds.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct VariantContent {
    pub nodes: Vec<TreeNode>,
    pub edges: Vec<TreeEdge>,
    pub annotations: Vec<TreeAnnotation>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct TreeVariant {
    pub id: String,
    pub name: String,
    pub content: VariantContent,
}

/// A tree as seen by the front: its variants in order, with their content.
#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RelationTree {
    pub id: String,
    pub title: String,
    pub variants: Vec<TreeVariant>,
}

fn invalid(message: impl Into<String>) -> AppError {
    AppError::InvalidInput(message.into())
}

fn check_len(what: &str, value: &str, max: usize) -> AppResult<()> {
    if value.chars().count() > max {
        return Err(invalid(format!("{what} longer than {max} characters")));
    }
    Ok(())
}

fn check_id(what: &str, id: &str, seen: &mut HashSet<String>) -> AppResult<()> {
    if id.is_empty() || id.len() > MAX_SHORT_LEN {
        return Err(invalid(format!("{what} needs an id")));
    }
    if !seen.insert(id.to_owned()) {
        return Err(invalid(format!("{what} id used twice: {id}")));
    }
    Ok(())
}

fn check_coordinate(what: &str, value: f64) -> AppResult<()> {
    if !value.is_finite() || value.abs() > MAX_COORDINATE {
        return Err(invalid(format!("{what} out of bounds: {value}")));
    }
    Ok(())
}

/// Checks a variant's content: unique ids, edges between nodes (or from
/// edges) of the content, no loop, no junction cycle, known relation types,
/// bounded sizes.
pub fn check(content: &VariantContent, relation_types: &[String]) -> AppResult<()> {
    if content.nodes.len() + content.edges.len() + content.annotations.len() > MAX_ITEMS {
        return Err(invalid(format!(
            "a variant holds at most {MAX_ITEMS} items"
        )));
    }
    let mut ids = HashSet::new();
    for node in &content.nodes {
        check_id("node", &node.id, &mut ids)?;
        check_coordinate("node x", node.x)?;
        check_coordinate("node y", node.y)?;
        check_len("node name", &node.label, MAX_TEXT_LEN)?;
    }
    let nodes: HashSet<&str> = content.nodes.iter().map(|node| node.id.as_str()).collect();
    let edges: HashMap<&str, &TreeEdge> = content
        .edges
        .iter()
        .map(|edge| (edge.id.as_str(), edge))
        .collect();
    for edge in &content.edges {
        check_id("edge", &edge.id, &mut ids)?;
        if !nodes.contains(edge.target.as_str()) {
            return Err(invalid(format!("edge to an unknown node: {}", edge.target)));
        }
        match &edge.source {
            EdgeSource::Node(id) => {
                if !nodes.contains(id.as_str()) {
                    return Err(invalid(format!("edge from an unknown node: {id}")));
                }
                if id == &edge.target {
                    return Err(invalid("an edge cannot link a node to itself"));
                }
            }
            EdgeSource::Edge(id) => {
                if !edges.contains_key(id.as_str()) || id == &edge.id {
                    return Err(invalid(format!("junction on an unknown edge: {id}")));
                }
            }
        }
        if let Some(kind) = &edge.relation_type_id
            && !relation_types.contains(kind)
        {
            return Err(invalid(format!("unknown relation type: {kind}")));
        }
    }
    // Junctions end on an edge from a node: no cycle of edges.
    for edge in &content.edges {
        let mut current = edge;
        let mut steps = 0;
        while let EdgeSource::Edge(id) = &current.source {
            steps += 1;
            if steps > content.edges.len() {
                return Err(invalid("junctions make a cycle"));
            }
            current = edges[id.as_str()];
        }
    }
    for annotation in &content.annotations {
        check_id("annotation", annotation.id(), &mut ids)?;
        match annotation {
            TreeAnnotation::Drawing {
                points,
                color,
                width,
                ..
            } => {
                if points.len() < 2 || points.len() > MAX_POINTS {
                    return Err(invalid(format!(
                        "a drawing has between 2 and {MAX_POINTS} points"
                    )));
                }
                for [x, y] in points {
                    check_coordinate("drawing point", *x)?;
                    check_coordinate("drawing point", *y)?;
                }
                check_len("drawing colour", color, MAX_SHORT_LEN)?;
                if !(0.5..=50.0).contains(width) {
                    return Err(invalid(format!("drawing width out of bounds: {width}")));
                }
            }
            TreeAnnotation::Text {
                x,
                y,
                text,
                color,
                size,
                ..
            } => {
                check_coordinate("text x", *x)?;
                check_coordinate("text y", *y)?;
                check_len("text", text, MAX_TEXT_LEN)?;
                check_len("text colour", color, MAX_SHORT_LEN)?;
                if !(4.0..=200.0).contains(size) {
                    return Err(invalid(format!("text size out of bounds: {size}")));
                }
            }
        }
    }
    Ok(())
}

/// Edges in an order where a junction comes after the edge it starts from.
fn edges_in_order(edges: &[TreeEdge]) -> Vec<&TreeEdge> {
    let mut placed: HashSet<&str> = HashSet::new();
    let mut ordered = Vec::with_capacity(edges.len());
    while ordered.len() < edges.len() {
        let before = ordered.len();
        for edge in edges {
            if placed.contains(edge.id.as_str()) {
                continue;
            }
            let ready = match &edge.source {
                EdgeSource::Node(_) => true,
                EdgeSource::Edge(id) => placed.contains(id.as_str()),
            };
            if ready {
                placed.insert(edge.id.as_str());
                ordered.push(edge);
            }
        }
        if ordered.len() == before {
            break;
        }
    }
    ordered
}

async fn write_content(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    variant_id: &str,
    content: &VariantContent,
) -> AppResult<()> {
    queries::clear(tx, variant_id).await?;
    for (order, node) in content.nodes.iter().enumerate() {
        let row = NodeRow {
            id: node.id.clone(),
            card_id: node.card_id.clone(),
            label: node.label.clone(),
            x: node.x,
            y: node.y,
        };
        queries::insert_node(tx, variant_id, &row, order as i64).await?;
    }
    for (order, edge) in edges_in_order(&content.edges).into_iter().enumerate() {
        let (source_node_id, source_edge_id) = match &edge.source {
            EdgeSource::Node(id) => (Some(id.clone()), None),
            EdgeSource::Edge(id) => (None, Some(id.clone())),
        };
        let row = EdgeRow {
            id: edge.id.clone(),
            source_node_id,
            source_edge_id,
            target_node_id: edge.target.clone(),
            relation_type_id: edge.relation_type_id.clone(),
            line_style: edge.line_style.as_str().to_owned(),
        };
        queries::insert_edge(tx, variant_id, &row, order as i64).await?;
    }
    for (order, annotation) in content.annotations.iter().enumerate() {
        let row = AnnotationRow {
            id: annotation.id().to_owned(),
            data: serde_json::to_string(annotation)
                .map_err(|error| AppError::Internal(format!("annotation json: {error}")))?,
        };
        queries::insert_annotation(tx, variant_id, &row, order as i64).await?;
    }
    Ok(())
}

async fn content(pool: &SqlitePool, variant_id: &str) -> AppResult<VariantContent> {
    let nodes = queries::nodes(pool, variant_id)
        .await?
        .into_iter()
        .map(|node| TreeNode {
            id: node.id,
            card_id: node.card_id,
            label: node.label,
            x: node.x,
            y: node.y,
        })
        .collect();
    let edges = queries::edges(pool, variant_id)
        .await?
        .into_iter()
        .filter_map(|edge| {
            let source = match (edge.source_node_id, edge.source_edge_id) {
                (Some(id), _) => EdgeSource::Node(id),
                (None, Some(id)) => EdgeSource::Edge(id),
                (None, None) => return None,
            };
            Some(TreeEdge {
                id: edge.id,
                source,
                target: edge.target_node_id,
                relation_type_id: edge.relation_type_id,
                line_style: LineStyle::parse(&edge.line_style),
            })
        })
        .collect();
    let mut annotations = Vec::new();
    for row in queries::annotations(pool, variant_id).await? {
        match serde_json::from_str::<TreeAnnotation>(&row.data) {
            Ok(annotation) => annotations.push(annotation),
            Err(error) => tracing::warn!(%error, id = row.id, "unreadable tree annotation"),
        }
    }
    Ok(VariantContent {
        nodes,
        edges,
        annotations,
    })
}

/// A variant with one empty node.
fn first_content() -> VariantContent {
    VariantContent {
        nodes: vec![TreeNode {
            id: Uuid::new_v4().to_string(),
            card_id: None,
            label: String::new(),
            x: 0.0,
            y: 0.0,
        }],
        ..VariantContent::default()
    }
}

/// The same content with new ids (a copied variant or tree).
fn with_new_ids(content: &VariantContent) -> VariantContent {
    let mut renamed: HashMap<String, String> = HashMap::new();
    let mut fresh = |old: &str| {
        renamed
            .entry(old.to_owned())
            .or_insert_with(|| Uuid::new_v4().to_string())
            .clone()
    };
    let nodes = content
        .nodes
        .iter()
        .map(|node| TreeNode {
            id: fresh(&node.id),
            ..node.clone()
        })
        .collect();
    let edges = content
        .edges
        .iter()
        .map(|edge| TreeEdge {
            id: fresh(&edge.id),
            source: match &edge.source {
                EdgeSource::Node(id) => EdgeSource::Node(fresh(id)),
                EdgeSource::Edge(id) => EdgeSource::Edge(fresh(id)),
            },
            target: fresh(&edge.target),
            ..edge.clone()
        })
        .collect();
    let annotations = content
        .annotations
        .iter()
        .map(|annotation| match annotation.clone() {
            TreeAnnotation::Drawing {
                points,
                color,
                width,
                ..
            } => TreeAnnotation::Drawing {
                id: Uuid::new_v4().to_string(),
                points,
                color,
                width,
            },
            TreeAnnotation::Text {
                x,
                y,
                text,
                color,
                size,
                ..
            } => TreeAnnotation::Text {
                id: Uuid::new_v4().to_string(),
                x,
                y,
                text,
                color,
                size,
            },
        })
        .collect();
    VariantContent {
        nodes,
        edges,
        annotations,
    }
}

fn check_name(what: &str, name: &str) -> AppResult<String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err(invalid(format!("a {what} needs a name")));
    }
    check_len(what, trimmed, 200)?;
    Ok(trimmed.to_owned())
}

/// Creates a tree named `title` with one variant named `variant_name`
/// (both translated by the front) holding one empty node.
pub async fn create(pool: &SqlitePool, title: &str, variant_name: &str) -> AppResult<RelationTree> {
    let variant_name = check_name("variant", variant_name)?;
    let mut tx = db::begin_write(pool).await?;
    let document = documents::create_in(&mut tx, DocumentKind::Tree, title).await?;
    queries::insert_tree(&mut tx, &document.id).await?;
    let variant_id = Uuid::new_v4().to_string();
    queries::insert_variant(&mut tx, &variant_id, &document.id, &variant_name, 0).await?;
    write_content(&mut tx, &variant_id, &first_content()).await?;
    tx.commit().await?;
    get(pool, &document.id).await
}

pub async fn get(pool: &SqlitePool, id: &str) -> AppResult<RelationTree> {
    let title = queries::tree_title(pool, id)
        .await?
        .ok_or_else(|| invalid(format!("tree not found: {id}")))?;
    let mut variants = Vec::new();
    for variant in queries::variants(pool, id).await? {
        variants.push(TreeVariant {
            content: content(pool, &variant.id).await?,
            id: variant.id,
            name: variant.name,
        });
    }
    Ok(RelationTree {
        id: id.to_owned(),
        title,
        variants,
    })
}

/// Replaces the content of the variant `variant_id` with `content`, once
/// checked. The other variants are not touched.
pub async fn save_variant(
    pool: &SqlitePool,
    variant_id: &str,
    content: &VariantContent,
) -> AppResult<()> {
    check(content, &queries::relation_type_ids(pool).await?)?;
    let tree_id = queries::tree_of_variant(pool, variant_id)
        .await?
        .ok_or_else(|| invalid(format!("variant not found: {variant_id}")))?;
    let mut tx = db::begin_write(pool).await?;
    write_content(&mut tx, variant_id, content).await?;
    db::documents::touch(&mut tx, &tree_id, &documents::now()).await?;
    tx.commit().await?;
    Ok(())
}

/// A new variant named `name`, a copy of the variant `copy_of`, right after
/// it. Returns the tree as now.
pub async fn add_variant(pool: &SqlitePool, copy_of: &str, name: &str) -> AppResult<RelationTree> {
    let name = check_name("variant", name)?;
    let tree_id = queries::tree_of_variant(pool, copy_of)
        .await?
        .ok_or_else(|| invalid(format!("variant not found: {copy_of}")))?;
    let variants = queries::variants(pool, &tree_id).await?;
    if variants.len() >= MAX_VARIANTS {
        return Err(invalid(format!(
            "a tree has at most {MAX_VARIANTS} variants"
        )));
    }
    let copied = with_new_ids(&content(pool, copy_of).await?);
    let position = variants
        .iter()
        .position(|variant| variant.id == copy_of)
        .unwrap_or(variants.len().saturating_sub(1))
        + 1;
    let id = Uuid::new_v4().to_string();
    let mut tx = db::begin_write(pool).await?;
    let mut order = 0;
    for (index, variant) in variants.iter().enumerate() {
        if index == position {
            order += 1;
        }
        queries::set_variant_order(&mut tx, &variant.id, order).await?;
        order += 1;
    }
    queries::insert_variant(&mut tx, &id, &tree_id, &name, position as i64).await?;
    write_content(&mut tx, &id, &copied).await?;
    tx.commit().await?;
    get(pool, &tree_id).await
}

pub async fn rename_variant(pool: &SqlitePool, id: &str, name: &str) -> AppResult<()> {
    let name = check_name("variant", name)?;
    if !queries::rename_variant(pool, id, &name).await? {
        return Err(invalid(format!("variant not found: {id}")));
    }
    Ok(())
}

/// Moves the variant `id` to `index` among the tree's variants.
pub async fn move_variant(pool: &SqlitePool, id: &str, index: usize) -> AppResult<()> {
    let tree_id = queries::tree_of_variant(pool, id)
        .await?
        .ok_or_else(|| invalid(format!("variant not found: {id}")))?;
    let mut ids: Vec<String> = queries::variants(pool, &tree_id)
        .await?
        .into_iter()
        .map(|variant| variant.id)
        .filter(|other| other != id)
        .collect();
    ids.insert(index.min(ids.len()), id.to_owned());
    let mut tx = db::begin_write(pool).await?;
    for (order, variant) in ids.iter().enumerate() {
        queries::set_variant_order(&mut tx, variant, order as i64).await?;
    }
    tx.commit().await?;
    Ok(())
}

/// Deletes the variant `id`; the last variant of a tree stays.
pub async fn delete_variant(pool: &SqlitePool, id: &str) -> AppResult<()> {
    let tree_id = queries::tree_of_variant(pool, id)
        .await?
        .ok_or_else(|| invalid(format!("variant not found: {id}")))?;
    if queries::variants(pool, &tree_id).await?.len() <= 1 {
        return Err(invalid("the last variant of a tree cannot be deleted"));
    }
    let mut tx = db::begin_write(pool).await?;
    queries::delete_variant(&mut tx, id).await?;
    tx.commit().await?;
    Ok(())
}

/// Duplicates the tree `id` as `title`: same variants and contents (new
/// ids), placed right after it.
pub async fn duplicate(pool: &SqlitePool, id: &str, title: &str) -> AppResult<RelationTree> {
    let tree = get(pool, id).await?;
    let mut tx = db::begin_write(pool).await?;
    let document = documents::create_in(&mut tx, DocumentKind::Tree, title).await?;
    queries::insert_tree(&mut tx, &document.id).await?;
    for (order, variant) in tree.variants.iter().enumerate() {
        let variant_id = Uuid::new_v4().to_string();
        queries::insert_variant(
            &mut tx,
            &variant_id,
            &document.id,
            &variant.name,
            order as i64,
        )
        .await?;
        write_content(&mut tx, &variant_id, &with_new_ids(&variant.content)).await?;
    }
    tree::place_after(&mut tx, id, &document.id).await?;
    tx.commit().await?;
    get(pool, &document.id).await
}

// --- Relation types ------------------------------------------------------------

fn relation_type(row: RelationTypeRow) -> RelationType {
    RelationType {
        category: RelationCategory::parse(&row.category),
        id: row.id,
        builtin: row.builtin,
        name: row.name,
        icon: row.icon,
        inverse_id: row.inverse_id,
    }
}

pub async fn relation_types(pool: &SqlitePool) -> AppResult<Vec<RelationType>> {
    Ok(queries::relation_types(pool)
        .await?
        .into_iter()
        .map(relation_type)
        .collect())
}

/// Sets the inverse of `id` (both ways), clearing old pairings.
async fn pair_inverse(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    id: &str,
    inverse: Option<&str>,
) -> AppResult<()> {
    for other in queries::inverses_of(tx, id).await? {
        if other != id {
            queries::set_inverse(tx, &other, None).await?;
        }
    }
    queries::set_inverse(tx, id, inverse).await?;
    if let Some(inverse) = inverse
        && inverse != id
    {
        for other in queries::inverses_of(tx, inverse).await? {
            if other != inverse && other != id {
                queries::set_inverse(tx, &other, None).await?;
            }
        }
        queries::set_inverse(tx, inverse, Some(id)).await?;
    }
    Ok(())
}

async fn check_input(
    pool: &SqlitePool,
    input: &RelationTypeInput,
    id: Option<&str>,
) -> AppResult<String> {
    let name = check_name("relation type", &input.name)?;
    if input.icon.is_empty() || input.icon.len() > MAX_SHORT_LEN {
        return Err(invalid("a relation type needs an icon"));
    }
    if let Some(inverse) = &input.inverse_id
        && Some(inverse.as_str()) != id
    {
        match queries::relation_type(pool, inverse).await? {
            None => return Err(invalid(format!("unknown relation type: {inverse}"))),
            // Pairing would undo a provided pair (parent ↔ child).
            Some(row) if row.builtin.is_some() => {
                return Err(invalid("a provided relation type cannot be an inverse"));
            }
            Some(_) => {}
        }
    }
    Ok(name)
}

/// A relation type of the world.
pub async fn create_relation_type(
    pool: &SqlitePool,
    input: &RelationTypeInput,
) -> AppResult<RelationType> {
    let name = check_input(pool, input, None).await?;
    let id = Uuid::new_v4().to_string();
    let mut tx = db::begin_write(pool).await?;
    let row = RelationTypeRow {
        id: id.clone(),
        builtin: None,
        name,
        icon: input.icon.clone(),
        inverse_id: None,
        category: input.category.as_str().to_owned(),
    };
    queries::insert_relation_type(&mut tx, &row).await?;
    let inverse = if input.symmetric {
        Some(id.as_str())
    } else {
        input.inverse_id.as_deref()
    };
    pair_inverse(&mut tx, &id, inverse).await?;
    tx.commit().await?;
    queries::relation_type(pool, &id)
        .await?
        .map(relation_type)
        .ok_or_else(|| AppError::Internal("relation type not saved".into()))
}

/// Changes a type of the world (the provided ones cannot be changed).
pub async fn update_relation_type(
    pool: &SqlitePool,
    id: &str,
    input: &RelationTypeInput,
) -> AppResult<RelationType> {
    let current = queries::relation_type(pool, id)
        .await?
        .ok_or_else(|| invalid(format!("relation type not found: {id}")))?;
    if current.builtin.is_some() {
        return Err(invalid("a provided relation type cannot be changed"));
    }
    let name = check_input(pool, input, Some(id)).await?;
    let mut tx = db::begin_write(pool).await?;
    queries::update_relation_type(&mut tx, id, &name, &input.icon, input.category.as_str()).await?;
    let inverse = if input.symmetric {
        Some(id)
    } else {
        input.inverse_id.as_deref()
    };
    pair_inverse(&mut tx, id, inverse).await?;
    tx.commit().await?;
    queries::relation_type(pool, id)
        .await?
        .map(relation_type)
        .ok_or_else(|| AppError::Internal("relation type lost".into()))
}

/// Number of tree edges using the type `id` (before deleting it).
pub async fn relation_type_uses(pool: &SqlitePool, id: &str) -> AppResult<u32> {
    let count = queries::count_edges_of_type(pool, id).await?;
    Ok(u32::try_from(count).unwrap_or(u32::MAX))
}

/// Deletes a type of the world; its edges become « without type ».
pub async fn delete_relation_type(pool: &SqlitePool, id: &str) -> AppResult<()> {
    let current = queries::relation_type(pool, id)
        .await?
        .ok_or_else(|| invalid(format!("relation type not found: {id}")))?;
    if current.builtin.is_some() {
        return Err(invalid("a provided relation type cannot be deleted"));
    }
    let mut tx = db::begin_write(pool).await?;
    queries::delete_relation_type(&mut tx, id).await?;
    tx.commit().await?;
    Ok(())
}

#[cfg(test)]
mod tests;
