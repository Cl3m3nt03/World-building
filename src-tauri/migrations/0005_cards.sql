-- Cards: the world's entries (docs/features/01-cartes-et-types.md).
-- Never edit a merged migration: add a new file instead (CLAUDE.md).

-- A card's own data; its id, title, dates and trash state are in `documents`.
CREATE TABLE cards (
    document_id    TEXT PRIMARY KEY NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
    -- Type or subtype. Deleting a type moves its cards to another type first
    -- (Rust side); SET NULL only guards against a type row vanishing.
    type_id        TEXT REFERENCES card_types (id) ON DELETE SET NULL,
    -- Asset id of the card's image. No foreign key: deleting the asset
    -- clears it on the Rust side.
    image_asset_id TEXT,
    -- Other names of the card, JSON: ["...", "..."].
    aliases        TEXT NOT NULL DEFAULT '[]',
    -- Content blocks, JSON (M2 step 2.9).
    content        TEXT NOT NULL DEFAULT '[]',
    -- Plain text of the content, for search.
    content_text   TEXT NOT NULL DEFAULT ''
) STRICT;

CREATE INDEX cards_by_type ON cards (type_id);
CREATE INDEX cards_by_image ON cards (image_asset_id) WHERE image_asset_id IS NOT NULL;
