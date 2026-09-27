-- Card types and subtypes (docs/features/01-cartes-et-types.md).
-- Never edit a merged migration: add a new file instead (CLAUDE.md).

CREATE TABLE card_types (
    -- UUID v4.
    id              TEXT PRIMARY KEY NOT NULL,
    -- Set for a subtype; deleting a type deletes its subtypes.
    parent_id       TEXT REFERENCES card_types (id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    -- lucide icon name (kebab-case), from the app's icon set.
    icon            TEXT NOT NULL,
    -- Name of a type color of the palette (tokens --bz-type-<color>).
    color           TEXT NOT NULL,
    -- Guided template, JSON: [{ "title": "...", "prompt": "..." }].
    guided_template TEXT NOT NULL DEFAULT '[]',
    -- Default card settings. Checked by the Rust side, not here, so the
    -- canvas formats can still evolve with the canvas (M7).
    orientation     TEXT NOT NULL DEFAULT 'portrait',
    canvas_format   TEXT NOT NULL DEFAULT 'standard',
    -- Order among the types (or among the subtypes of a type).
    sort_order      INTEGER NOT NULL,
    created_at      TEXT NOT NULL
) STRICT;

CREATE INDEX card_types_by_parent ON card_types (parent_id, sort_order);
