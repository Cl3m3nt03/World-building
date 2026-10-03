-- A tree cites the cards it shows, as a map cites its pins (ADR 0007,
-- M7.5 step 7.5.2): a new link kind `tree`, from the tree to each card on
-- one of its variants. SQLite cannot change a CHECK constraint: the table is
-- made again, with its rows.
-- Never edit a merged migration: add a new file instead (CLAUDE.md).

CREATE TABLE links_new (
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    kind      TEXT NOT NULL CHECK (kind IN ('mention', 'property', 'map_pin', 'tree')),
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

-- The trees already drawn cite their cards at once.
INSERT OR IGNORE INTO links (source_id, target_id, kind, detail)
    SELECT DISTINCT v.tree_id, n.card_id, 'tree', ''
    FROM tree_nodes n JOIN tree_variants v ON v.id = n.variant_id
    WHERE n.card_id IS NOT NULL;
