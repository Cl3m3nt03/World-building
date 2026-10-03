-- The wiki (docs/features/07-wiki.md, M8 step 8.1): which documents have a
-- page, and the wiki's own settings.
-- Never edit a merged migration: add a new file instead (CLAUDE.md).

-- A card or a map marked « Visible dans le wiki ».
ALTER TABLE documents
    ADD COLUMN wiki_visible INTEGER NOT NULL DEFAULT 0 CHECK (wiki_visible IN (0, 1));

-- One row: the home page and the style of the wiki.
CREATE TABLE wiki_settings (
    id              INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
    -- Empty: the world's name.
    title           TEXT NOT NULL DEFAULT '',
    description     TEXT NOT NULL DEFAULT '',
    -- No foreign key: a deleted asset leaves no banner, like card images.
    banner_asset_id TEXT,
    -- JSON: the ids of the cards shown on the home page, in order.
    featured        TEXT NOT NULL DEFAULT '[]',
    -- JSON: preset, palette, fonts, saved palettes (read with tolerance).
    theme           TEXT NOT NULL DEFAULT '{}'
) STRICT;

INSERT INTO wiki_settings (id) VALUES (1);
