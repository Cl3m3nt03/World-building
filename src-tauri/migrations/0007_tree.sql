-- Sidebar tree (M3 step 3.1, docs/features/02-organisation.md): folders,
-- parent / child documents, manual order and pins.
-- Never edit a merged migration: add a new file instead (CLAUDE.md).
--
-- A document is in exactly one place: under a parent document
-- (`parent_id`), in a folder (`folder_id`), or at the root (both NULL);
-- never both (kept by the Rust side). Folders and documents share one
-- order inside the root and inside a folder; children of a document are
-- ordered among themselves.

CREATE TABLE folders (
    -- UUID v4.
    id         TEXT PRIMARY KEY NOT NULL,
    -- Enclosing folder; NULL at the root. No cascade: deleting a folder
    -- first lifts or trashes its content (Rust side).
    parent_id  TEXT REFERENCES folders (id),
    name       TEXT NOT NULL,
    -- Icon name, from the card types' icon library.
    icon       TEXT NOT NULL DEFAULT 'folder',
    -- Position among the folders and documents of the same place.
    sort_order INTEGER NOT NULL,
    -- RFC 3339.
    created_at TEXT NOT NULL
) STRICT;

CREATE INDEX folders_by_parent ON folders (parent_id, sort_order);

-- SET NULL only guards against a row vanishing: the Rust side moves the
-- content before deleting a folder, and a document whose parent is deleted
-- for good goes back to the root.
ALTER TABLE documents ADD COLUMN folder_id TEXT REFERENCES folders (id) ON DELETE SET NULL;
ALTER TABLE documents ADD COLUMN parent_id TEXT REFERENCES documents (id) ON DELETE SET NULL;
-- Position among the folders and documents of the same place.
ALTER TABLE documents ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
-- Position among the pinned documents; NULL when not pinned (step 3.5).
ALTER TABLE documents ADD COLUMN pinned_order INTEGER;

CREATE INDEX documents_by_folder ON documents (folder_id, sort_order);
CREATE INDEX documents_by_parent ON documents (parent_id, sort_order);

-- Worlds made before M3: every document at the root, in creation order.
UPDATE documents
SET sort_order = (
    SELECT COUNT(*) FROM documents AS earlier
    WHERE earlier.created_at < documents.created_at
       OR (earlier.created_at = documents.created_at AND earlier.id < documents.id)
);
