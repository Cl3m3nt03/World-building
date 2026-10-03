-- A link property can carry a relation of the world (ADR 0007, M7.5 step
-- 7.5.3): « Parents » = parent of. Its values become known relations: each
-- chosen card is that relation of the card holding the property.
-- Never edit a merged migration: add a new file instead (CLAUDE.md).

ALTER TABLE property_definitions
    ADD COLUMN relation_type_id TEXT REFERENCES relation_types (id) ON DELETE SET NULL;
