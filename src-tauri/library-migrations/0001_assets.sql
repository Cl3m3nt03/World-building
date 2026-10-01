-- Library shared by the worlds (ADR 0006): the same assets table as a
-- world's media library, for the files of library/assets/.
-- Never edit a merged migration: add a new file instead (CLAUDE.md).

CREATE TABLE assets (
    -- File name in library/assets/, also the asset id.
    id         TEXT PRIMARY KEY NOT NULL,
    -- Name shown in the library, editable.
    name       TEXT NOT NULL,
    kind       TEXT NOT NULL CHECK (kind IN ('image', 'audio', 'other')),
    mime       TEXT NOT NULL,
    size       INTEGER NOT NULL CHECK (size >= 0),
    -- Pixel dimensions, for images whose header could be read.
    width      INTEGER,
    height     INTEGER,
    -- RFC 3339 date it was added to the library.
    created_at TEXT NOT NULL
) STRICT;

CREATE INDEX assets_by_created_at ON assets (created_at DESC);
