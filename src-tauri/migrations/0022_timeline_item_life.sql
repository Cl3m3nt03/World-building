-- A period standing for a card may be its life, birth to death (M11+, #415):
-- the timeline then tells that card's age at other items' dates.
ALTER TABLE timeline_items ADD COLUMN life INTEGER NOT NULL DEFAULT 0 CHECK (life IN (0, 1));
