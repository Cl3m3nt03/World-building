-- More provided relation types, as listed on the board (docs/contexte.md,
-- Relation Tree): half-siblings, adoption, step-family and exes, next to
-- the five of 0012. Their `builtin` key is translated by the front.
-- Never edit a merged migration: add a new file instead (CLAUDE.md).

INSERT INTO relation_types (id, builtin, icon, inverse_id, category, sort_order) VALUES
    ('rel-half-sibling', 'half-sibling', 'users-round', NULL, 'family', 3),
    ('rel-adopted', 'adopted', 'hand-heart', NULL, 'family', 4),
    ('rel-adoptive-parent', 'adoptive-parent', 'house-heart', NULL, 'family', 5),
    ('rel-step-parent', 'step-parent', 'arrow-up-right', NULL, 'family', 6),
    ('rel-step-child', 'step-child', 'arrow-down-right', NULL, 'family', 7),
    ('rel-ex', 'ex', 'heart-crack', NULL, 'couple', 10);
UPDATE relation_types SET inverse_id = 'rel-adoptive-parent' WHERE id = 'rel-adopted';
UPDATE relation_types SET inverse_id = 'rel-adopted' WHERE id = 'rel-adoptive-parent';
UPDATE relation_types SET inverse_id = 'rel-step-child' WHERE id = 'rel-step-parent';
UPDATE relation_types SET inverse_id = 'rel-step-parent' WHERE id = 'rel-step-child';
UPDATE relation_types SET inverse_id = id WHERE id IN ('rel-half-sibling', 'rel-ex');
-- Couples after the family; the world's own types keep coming after these.
UPDATE relation_types SET sort_order = 8 WHERE id = 'rel-partner';
UPDATE relation_types SET sort_order = 9 WHERE id = 'rel-spouse';
UPDATE relation_types SET sort_order = sort_order + 6 WHERE builtin IS NULL;
