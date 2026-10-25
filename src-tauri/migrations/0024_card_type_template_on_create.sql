-- V2-3.5 (#476): a new card receives its type's guided template at once,
-- unless the type says otherwise. On for every existing type.
ALTER TABLE card_types ADD COLUMN template_on_create INTEGER NOT NULL DEFAULT 1;
