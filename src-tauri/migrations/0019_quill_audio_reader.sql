-- Quill, advanced (docs/features/08-quill.md, M10 step 10.1, ADR 0010): the
-- sounds of a draft and the reading settings of a story.
-- Never edit a merged migration: add a new file instead (CLAUDE.md).

-- JSON: page theme, reading mode, background, font, text size, chapter
-- layout and reading speed (read with tolerance, defaults otherwise).
ALTER TABLE stories ADD COLUMN reader_settings TEXT NOT NULL DEFAULT '{}';

-- A sound on a passage of a draft: an effect played when reading reaches the
-- passage, or an ambience heard all along it. Like a note, the passage
-- carries a mark with the sound's id in the draft's content.
CREATE TABLE audio_cues (
    id         TEXT PRIMARY KEY NOT NULL,
    draft_id   TEXT NOT NULL REFERENCES drafts (id) ON DELETE CASCADE,
    kind       TEXT NOT NULL CHECK (kind IN ('effect', 'ambience')),
    -- An audio asset of the media library; no foreign key, like images: a
    -- sound whose file is gone is shown as such and skipped.
    asset_id   TEXT,
    volume     INTEGER NOT NULL DEFAULT 80 CHECK (volume BETWEEN 0 AND 100),
    looped     INTEGER NOT NULL DEFAULT 0 CHECK (looped IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
) STRICT;

CREATE INDEX audio_cues_by_draft ON audio_cues (draft_id);
CREATE INDEX audio_cues_by_asset ON audio_cues (asset_id);
