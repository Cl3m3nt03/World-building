-- Initial schema of a world database (world.db).
-- Never edit a merged migration: add a new file instead (CLAUDE.md).

-- Free-form key/value metadata about the world database itself.
-- The world identity (id, name, schema version, dates) lives in world.json.
CREATE TABLE meta (
    key   TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
) STRICT;

INSERT INTO meta (key, value) VALUES ('created_by', 'BuilderZ');
