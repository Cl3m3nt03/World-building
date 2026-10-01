-- Interface state of the world (M3 step 3.9, ADR 0005): one JSON value per
-- area of the interface ("sidebar": width, collapse, open folders, filters
-- and sort), read tolerantly by the Rust side.
-- Never edit a merged migration: add a new file instead (CLAUDE.md).

CREATE TABLE ui_state (
    key   TEXT PRIMARY KEY NOT NULL,
    -- JSON.
    value TEXT NOT NULL
) STRICT;
