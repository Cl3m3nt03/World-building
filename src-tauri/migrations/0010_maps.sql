-- Maps (docs/features/03-map.md, M4): an image with layers, pins, zones and
-- texts. Positions are relative to the image (0 to 1), so they survive a new
-- background. The front sends a map's whole content at each save; the Rust
-- side checks it and replaces these rows in one transaction.
-- Never edit a merged migration: add a new file instead (CLAUDE.md).

CREATE TABLE maps (
    document_id         TEXT PRIMARY KEY NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
    -- Asset id of the background. No foreign key: deleting the asset leaves
    -- the map without background (the map says so).
    background_asset_id TEXT,
    -- Pixel size of the background, for the view's bounds.
    width               INTEGER NOT NULL CHECK (width > 0),
    height              INTEGER NOT NULL CHECK (height > 0),
    -- Folder of the background's tiles under the world, for very large
    -- images (step 4.3); NULL while not tiled.
    tiles_path          TEXT
) STRICT;

CREATE TABLE map_layers (
    id         TEXT PRIMARY KEY NOT NULL,
    map_id     TEXT NOT NULL REFERENCES maps (document_id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    visible    INTEGER NOT NULL CHECK (visible IN (0, 1)),
    -- Display order: 0 is drawn first (under the others).
    sort_order INTEGER NOT NULL
) STRICT;
CREATE INDEX map_layers_by_map ON map_layers (map_id, sort_order);

CREATE TABLE map_pins (
    id         TEXT PRIMARY KEY NOT NULL,
    map_id     TEXT NOT NULL REFERENCES maps (document_id) ON DELETE CASCADE,
    layer_id   TEXT NOT NULL REFERENCES map_layers (id) ON DELETE CASCADE,
    -- The card the pin stands for; NULL for a plain marker. No foreign key:
    -- a card deleted for good leaves a dead reference, like links.
    card_id    TEXT,
    x          REAL NOT NULL CHECK (x BETWEEN 0 AND 1),
    y          REAL NOT NULL CHECK (y BETWEEN 0 AND 1),
    icon       TEXT NOT NULL,
    color      TEXT NOT NULL,
    label      TEXT NOT NULL,
    size       REAL NOT NULL CHECK (size > 0),
    sort_order INTEGER NOT NULL
) STRICT;
CREATE INDEX map_pins_by_map ON map_pins (map_id, sort_order);

CREATE TABLE map_zones (
    id          TEXT PRIMARY KEY NOT NULL,
    map_id      TEXT NOT NULL REFERENCES maps (document_id) ON DELETE CASCADE,
    layer_id    TEXT NOT NULL REFERENCES map_layers (id) ON DELETE CASCADE,
    -- Vertices, JSON: [[x, y], ...], at least 3.
    points      TEXT NOT NULL,
    label       TEXT NOT NULL,
    -- Label style, JSON: { "font": ..., "size": ... }.
    label_style TEXT NOT NULL,
    card_id     TEXT,
    fill_color  TEXT NOT NULL,
    opacity     REAL NOT NULL CHECK (opacity BETWEEN 0 AND 1),
    pattern     TEXT NOT NULL CHECK (pattern IN ('solid', 'hatch', 'dots', 'cross')),
    sort_order  INTEGER NOT NULL
) STRICT;
CREATE INDEX map_zones_by_map ON map_zones (map_id, sort_order);

CREATE TABLE map_texts (
    id         TEXT PRIMARY KEY NOT NULL,
    map_id     TEXT NOT NULL REFERENCES maps (document_id) ON DELETE CASCADE,
    layer_id   TEXT NOT NULL REFERENCES map_layers (id) ON DELETE CASCADE,
    x          REAL NOT NULL CHECK (x BETWEEN 0 AND 1),
    y          REAL NOT NULL CHECK (y BETWEEN 0 AND 1),
    text       TEXT NOT NULL,
    -- Style, JSON: { "font", "size", "spacing", "arc", "scaleWithZoom" }.
    style      TEXT NOT NULL,
    sort_order INTEGER NOT NULL
) STRICT;
CREATE INDEX map_texts_by_map ON map_texts (map_id, sort_order);
