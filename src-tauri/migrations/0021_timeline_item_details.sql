-- Timeline items as vvd shows them (M11 step 11.5b): an image of their own,
-- tags (a JSON list of strings) and whether the wiki leaves them out.
ALTER TABLE timeline_items ADD COLUMN image_asset_id TEXT;
ALTER TABLE timeline_items ADD COLUMN tags TEXT NOT NULL DEFAULT '[]';
ALTER TABLE timeline_items ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0, 1));
CREATE INDEX timeline_items_by_image ON timeline_items (image_asset_id)
    WHERE image_asset_id IS NOT NULL;
