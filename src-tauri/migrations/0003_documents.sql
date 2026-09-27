-- Documents and links: the base shared by every module (docs/features/README.md).
-- Never edit a merged migration: add a new file instead (CLAUDE.md).
--
-- Only what M2 uses is here. Folders, parent/child, manual order and pins
-- (M3) and wiki visibility (M8) come with their own migrations, as new
-- nullable or defaulted columns.

-- Everything shown in the sidebar: a card, a map, a graph configuration,
-- a canvas or a relation tree. Each kind keeps its own data in its tables.
CREATE TABLE documents (
    -- UUID v4.
    id         TEXT PRIMARY KEY NOT NULL,
    kind       TEXT NOT NULL CHECK (kind IN ('card', 'map', 'graph', 'canvas', 'tree')),
    title      TEXT NOT NULL,
    -- RFC 3339 dates.
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    -- Last time the document was opened (recent documents, "pick up where
    -- you left off"), if ever.
    opened_at  TEXT,
    -- Set while the document is in the world's trash, restorable until the
    -- trash is emptied.
    trashed_at TEXT
) STRICT;

CREATE INDEX documents_by_kind ON documents (kind, trashed_at);
CREATE INDEX documents_by_opened_at ON documents (opened_at DESC) WHERE opened_at IS NOT NULL;

-- Links from a source (a document, later a Quill chapter) to a target card.
-- Kept up to date by the Rust side on every save; they feed the graph, the
-- backlinks ("cited in") and name detection in Quill.
--
-- No foreign keys on purpose: a link to a document deleted for good stays
-- as a dead reference, shown as such. Links *from* a deleted document are
-- removed with it by the Rust side.
CREATE TABLE links (
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    kind      TEXT NOT NULL CHECK (kind IN ('mention', 'property', 'map_pin')),
    -- Where the link comes from inside the source (a property id, a pin id…),
    -- so one source can link the same target several ways; '' when unused.
    detail    TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (source_id, kind, detail, target_id)
) STRICT;

CREATE INDEX links_by_target ON links (target_id);
