-- Cause and effect on a timeline (M11+, #418): an arrow from an item to
-- another of the same timeline (« mène à »), gone with either of them.
CREATE TABLE timeline_links (
    id          TEXT PRIMARY KEY NOT NULL,
    timeline_id TEXT NOT NULL REFERENCES timelines (document_id) ON DELETE CASCADE,
    from_item   TEXT NOT NULL REFERENCES timeline_items (id) ON DELETE CASCADE,
    to_item     TEXT NOT NULL REFERENCES timeline_items (id) ON DELETE CASCADE,
    created_at  TEXT NOT NULL,
    UNIQUE (from_item, to_item),
    CHECK (from_item <> to_item)
);
CREATE INDEX timeline_links_by_timeline ON timeline_links (timeline_id);
