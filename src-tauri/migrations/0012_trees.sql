-- Relation trees (docs/features/05-relation-tree.md, M6): trees drawn by
-- hand, each with named variants. A variant holds nodes (a card or a plain
-- name), edges (from a node or from another edge: a junction) and
-- annotations. The front sends a variant's whole content at each save; the
-- Rust side checks it and replaces these rows in one transaction.
-- Never edit a merged migration: add a new file instead (CLAUDE.md).

-- Relation types, shared by every tree of the world. The provided ones have
-- a `builtin` key (translated by the front); the others a name.
CREATE TABLE relation_types (
    id         TEXT PRIMARY KEY NOT NULL,
    builtin    TEXT UNIQUE,
    name       TEXT NOT NULL DEFAULT '',
    -- lucide icon name.
    icon       TEXT NOT NULL,
    -- The relation the other way round (parent ↔ child); itself when
    -- symmetric (siblings, partners).
    inverse_id TEXT REFERENCES relation_types (id) ON DELETE SET NULL,
    category   TEXT NOT NULL CHECK (category IN ('family', 'couple', 'other', 'custom')),
    sort_order INTEGER NOT NULL
) STRICT;

INSERT INTO relation_types (id, builtin, icon, inverse_id, category, sort_order) VALUES
    ('rel-parent', 'parent', 'arrow-up', NULL, 'family', 0),
    ('rel-child', 'child', 'arrow-down', NULL, 'family', 1),
    ('rel-sibling', 'sibling', 'users', NULL, 'family', 2),
    ('rel-partner', 'partner', 'heart', NULL, 'couple', 3),
    ('rel-spouse', 'spouse', 'gem', NULL, 'couple', 4);
UPDATE relation_types SET inverse_id = 'rel-child' WHERE id = 'rel-parent';
UPDATE relation_types SET inverse_id = 'rel-parent' WHERE id = 'rel-child';
UPDATE relation_types SET inverse_id = id WHERE id IN ('rel-sibling', 'rel-partner', 'rel-spouse');

CREATE TABLE trees (
    document_id TEXT PRIMARY KEY NOT NULL REFERENCES documents (id) ON DELETE CASCADE
) STRICT;

CREATE TABLE tree_variants (
    id         TEXT PRIMARY KEY NOT NULL,
    tree_id    TEXT NOT NULL REFERENCES trees (document_id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    sort_order INTEGER NOT NULL
) STRICT;
CREATE INDEX tree_variants_by_tree ON tree_variants (tree_id, sort_order);

CREATE TABLE tree_nodes (
    id         TEXT PRIMARY KEY NOT NULL,
    variant_id TEXT NOT NULL REFERENCES tree_variants (id) ON DELETE CASCADE,
    -- The card the node stands for; NULL for a plain name (or an empty
    -- node). No foreign key: a card deleted for good leaves a dead
    -- reference, like links.
    card_id    TEXT,
    label      TEXT NOT NULL,
    x          REAL NOT NULL,
    y          REAL NOT NULL,
    sort_order INTEGER NOT NULL
) STRICT;
CREATE INDEX tree_nodes_by_variant ON tree_nodes (variant_id, sort_order);

CREATE TABLE tree_edges (
    id               TEXT PRIMARY KEY NOT NULL,
    variant_id       TEXT NOT NULL REFERENCES tree_variants (id) ON DELETE CASCADE,
    -- From a node, or from another edge (a junction); the Rust side checks
    -- that they belong to the same variant.
    source_node_id   TEXT,
    source_edge_id   TEXT,
    target_node_id   TEXT NOT NULL,
    -- NULL: a link without a type yet (« skip for now »).
    relation_type_id TEXT REFERENCES relation_types (id) ON DELETE SET NULL,
    line_style       TEXT NOT NULL CHECK (line_style IN ('solid', 'dashed', 'dotted')),
    sort_order       INTEGER NOT NULL,
    CHECK ((source_node_id IS NULL) <> (source_edge_id IS NULL))
) STRICT;
CREATE INDEX tree_edges_by_variant ON tree_edges (variant_id, sort_order);

CREATE TABLE tree_annotations (
    id         TEXT PRIMARY KEY NOT NULL,
    variant_id TEXT NOT NULL REFERENCES tree_variants (id) ON DELETE CASCADE,
    -- The annotation (drawing or text), JSON, read by the Rust side.
    data       TEXT NOT NULL,
    sort_order INTEGER NOT NULL
) STRICT;
CREATE INDEX tree_annotations_by_variant ON tree_annotations (variant_id, sort_order);
