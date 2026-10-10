-- Quill, writing (docs/features/08-quill.md, M9 step 9.1, ADR 0009): stories
-- with their chapters, each chapter with its drafts. Stories are not World
-- documents: they have their own tables and live in the Quill tab only.
-- Never edit a merged migration: add a new file instead (CLAUDE.md).

CREATE TABLE stories (
    id         TEXT PRIMARY KEY NOT NULL,
    title      TEXT NOT NULL,
    -- JSON: the book's colour and finish (read with tolerance).
    book_style TEXT NOT NULL DEFAULT '{}',
    -- JSON: the cover's image (an asset id) and where its title sits.
    cover      TEXT NOT NULL DEFAULT '{}',
    sort_order INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE chapters (
    id               TEXT PRIMARY KEY NOT NULL,
    story_id         TEXT NOT NULL REFERENCES stories (id) ON DELETE CASCADE,
    title            TEXT NOT NULL,
    sort_order       INTEGER NOT NULL,
    -- The draft that counts (words, links, exports). Set right after the
    -- chapter's first draft is made; no foreign key, drafts point back here.
    current_draft_id TEXT,
    -- The image over the chapter's text; no foreign key, like card images.
    header_asset_id  TEXT,
    created_at       TEXT NOT NULL,
    updated_at       TEXT NOT NULL
) STRICT;

CREATE INDEX chapters_by_story ON chapters (story_id, sort_order);

CREATE TABLE drafts (
    id           TEXT PRIMARY KEY NOT NULL,
    chapter_id   TEXT NOT NULL REFERENCES chapters (id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    -- JSON: a TipTap document.
    content      TEXT NOT NULL,
    -- Derived by the Rust side from `content`: plain text and its words.
    content_text TEXT NOT NULL DEFAULT '',
    word_count   INTEGER NOT NULL DEFAULT 0,
    sort_order   INTEGER NOT NULL,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL
) STRICT;

CREATE INDEX drafts_by_chapter ON drafts (chapter_id, sort_order);

-- A note on a passage of a draft. The passage carries a mark with the note's
-- id in the draft's content, so the anchor follows the text as it changes.
CREATE TABLE chapter_notes (
    id         TEXT PRIMARY KEY NOT NULL,
    draft_id   TEXT NOT NULL REFERENCES drafts (id) ON DELETE CASCADE,
    body       TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
) STRICT;

CREATE INDEX chapter_notes_by_draft ON chapter_notes (draft_id);

-- The layout of a story's world panel (dockview), kept per story.
CREATE TABLE writing_panel (
    story_id TEXT PRIMARY KEY NOT NULL REFERENCES stories (id) ON DELETE CASCADE,
    layout   TEXT NOT NULL DEFAULT '{}'
) STRICT;
