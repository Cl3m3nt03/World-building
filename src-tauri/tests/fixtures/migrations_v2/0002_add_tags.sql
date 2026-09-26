-- Test fixture: version 2 adds a column and a table.
ALTER TABLE notes ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;
CREATE TABLE tags (id INTEGER PRIMARY KEY NOT NULL, label TEXT NOT NULL) STRICT;
