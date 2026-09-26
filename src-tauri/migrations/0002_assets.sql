-- Media library: one row per file of assets/ (named <sha256>.<ext>).
-- Never edit a merged migration: add a new file instead (CLAUDE.md).

CREATE TABLE assets (
    -- File name in assets/, also the asset id.
    id         TEXT PRIMARY KEY NOT NULL,
    -- Name shown in the media library, editable.
    name       TEXT NOT NULL,
    kind       TEXT NOT NULL CHECK (kind IN ('image', 'audio', 'other')),
    mime       TEXT NOT NULL,
    size       INTEGER NOT NULL CHECK (size >= 0),
    -- Pixel dimensions, for images whose header could be read.
    width      INTEGER,
    height     INTEGER,
    -- RFC 3339 import date.
    created_at TEXT NOT NULL
) STRICT;

CREATE INDEX assets_by_created_at ON assets (created_at DESC);
