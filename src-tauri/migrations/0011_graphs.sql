-- Graphs (docs/features/04-graph.md, M5): a saved view of the world's cards
-- and their links. The nodes and edges are not stored: they come from the
-- cards and the `links` table each time. A graph keeps only its
-- configuration: filters, settings, pinned nodes and framing.
-- Never edit a merged migration: add a new file instead (CLAUDE.md).

CREATE TABLE graphs (
    document_id TEXT PRIMARY KEY NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
    -- Filters, JSON: { "typeIds": [...] } (no type: every card).
    filters     TEXT NOT NULL,
    -- Display and force settings, JSON (read tolerantly: a missing or
    -- unknown field takes its default value).
    settings    TEXT NOT NULL,
    -- Framing, JSON: { "x", "y", "zoom" }; NULL until the graph was framed.
    viewport    TEXT
) STRICT;

CREATE TABLE graph_pinned_nodes (
    graph_id TEXT NOT NULL REFERENCES graphs (document_id) ON DELETE CASCADE,
    -- No foreign key: a card deleted for good leaves a dead reference,
    -- ignored when the graph is drawn (like links).
    card_id  TEXT NOT NULL,
    -- Position in the graph's own coordinates.
    x        REAL NOT NULL,
    y        REAL NOT NULL,
    PRIMARY KEY (graph_id, card_id)
) STRICT;
