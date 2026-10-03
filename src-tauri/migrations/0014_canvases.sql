-- Canvases (docs/features/06-canvas.md, M7): free whiteboards drawn with
-- Excalidraw. The front holds the scene and sends it whole at each save;
-- the Rust side checks it and replaces it. Images are world assets: the
-- scene keeps only their id (an image element's `fileId`), never their
-- bytes. Never edit a merged migration: add a new file instead (CLAUDE.md).

CREATE TABLE canvases (
    document_id TEXT PRIMARY KEY NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
    -- The Excalidraw scene, JSON: { "elements": [...] }.
    scene       TEXT NOT NULL,
    -- What of Excalidraw's state is kept (framing, grid…), JSON object.
    app_state   TEXT NOT NULL
) STRICT;

-- The assets a canvas shows (its image elements), kept with each save: the
-- media library says where an asset is used.
CREATE TABLE canvas_assets (
    canvas_id TEXT NOT NULL REFERENCES canvases (document_id) ON DELETE CASCADE,
    asset_id  TEXT NOT NULL REFERENCES assets (id) ON DELETE CASCADE,
    PRIMARY KEY (canvas_id, asset_id)
) STRICT;
