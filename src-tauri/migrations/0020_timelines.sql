-- no-transaction
-- The world's timelines (docs/features/09-frise.md, M11 step 11.1, ADR 0011):
-- a new document kind, `timeline`, and a new link kind, `timeline`.
--
-- SQLite cannot change a CHECK constraint: `documents` and `links` are made
-- again with their rows. Six tables reference `documents` with ON DELETE
-- CASCADE: dropping it with the foreign keys on would delete their rows. As
-- SQLite's own procedure says (« Making Other Kinds Of Table Schema
-- Changes »), the foreign keys are turned off, which cannot be done inside a
-- transaction: this migration runs outside one and opens its own.
-- Never edit a merged migration: add a new file instead (CLAUDE.md).

PRAGMA foreign_keys = OFF;

BEGIN;

CREATE TABLE documents_new (
    -- UUID v4.
    id           TEXT PRIMARY KEY NOT NULL,
    kind         TEXT NOT NULL CHECK (kind IN ('card', 'map', 'graph', 'canvas', 'tree', 'timeline')),
    title        TEXT NOT NULL,
    -- RFC 3339 dates.
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL,
    -- Last time the document was opened, if ever.
    opened_at    TEXT,
    -- Set while the document is in the world's trash.
    trashed_at   TEXT,
    folder_id    TEXT REFERENCES folders (id) ON DELETE SET NULL,
    parent_id    TEXT REFERENCES documents (id) ON DELETE SET NULL,
    sort_order   INTEGER NOT NULL DEFAULT 0,
    pinned_order INTEGER,
    wiki_visible INTEGER NOT NULL DEFAULT 0 CHECK (wiki_visible IN (0, 1))
) STRICT;

INSERT INTO documents_new (id, kind, title, created_at, updated_at, opened_at, trashed_at,
                           folder_id, parent_id, sort_order, pinned_order, wiki_visible)
    SELECT id, kind, title, created_at, updated_at, opened_at, trashed_at,
           folder_id, parent_id, sort_order, pinned_order, wiki_visible
    FROM documents;

DROP TABLE documents;
ALTER TABLE documents_new RENAME TO documents;

CREATE INDEX documents_by_kind ON documents (kind, trashed_at);
CREATE INDEX documents_by_opened_at ON documents (opened_at DESC) WHERE opened_at IS NOT NULL;
CREATE INDEX documents_by_folder ON documents (folder_id, sort_order);
CREATE INDEX documents_by_parent ON documents (parent_id, sort_order);

-- The search triggers went with the old table (migration 0008).
CREATE TRIGGER search_document_added AFTER INSERT ON documents BEGIN
    INSERT INTO search (document_id, title, aliases, content) VALUES (new.id, new.title, '', '');
END;

CREATE TRIGGER search_document_renamed AFTER UPDATE OF title ON documents BEGIN
    UPDATE search SET title = new.title WHERE document_id = new.id;
END;

CREATE TRIGGER search_document_deleted AFTER DELETE ON documents BEGIN
    DELETE FROM search WHERE document_id = old.id;
END;

CREATE TABLE links_new (
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    kind      TEXT NOT NULL CHECK (kind IN ('mention', 'property', 'map_pin', 'tree', 'timeline')),
    -- Where the link comes from inside the source (a property id, a pin id…),
    -- so one source can link the same target several ways; '' when unused.
    detail    TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (source_id, kind, detail, target_id)
) STRICT;

INSERT INTO links_new (source_id, target_id, kind, detail)
    SELECT source_id, target_id, kind, detail FROM links;

DROP TABLE links;
ALTER TABLE links_new RENAME TO links;
CREATE INDEX links_by_target ON links (target_id);

-- A timeline: its tracks, in order, and its items on them.
CREATE TABLE timelines (
    document_id TEXT PRIMARY KEY NOT NULL REFERENCES documents (id) ON DELETE CASCADE
) STRICT;

CREATE TABLE timeline_tracks (
    id          TEXT PRIMARY KEY NOT NULL,
    timeline_id TEXT NOT NULL REFERENCES timelines (document_id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    -- A type colour key (red, amber, blue…).
    color       TEXT NOT NULL,
    sort_order  INTEGER NOT NULL
) STRICT;

CREATE INDEX timeline_tracks_by_timeline ON timeline_tracks (timeline_id, sort_order);

-- An event (a day, a month or a year) or a period (from `start_day` to
-- `end_day`). Days are whole days from the year 0 of the world's calendar;
-- `precision` says what the date names (ADR 0011).
CREATE TABLE timeline_items (
    id          TEXT PRIMARY KEY NOT NULL,
    track_id    TEXT NOT NULL REFERENCES timeline_tracks (id) ON DELETE CASCADE,
    -- The card the item stands for; no foreign key, like map pins.
    card_id     TEXT,
    title       TEXT NOT NULL,
    color       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    start_day   INTEGER NOT NULL,
    end_day     INTEGER,
    precision   TEXT NOT NULL CHECK (precision IN ('year', 'month', 'day')),
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    CHECK (end_day IS NULL OR end_day >= start_day)
) STRICT;

CREATE INDEX timeline_items_by_track ON timeline_items (track_id, start_day);

COMMIT;

PRAGMA foreign_keys = ON;
