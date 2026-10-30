-- Two new kinds of property, « select » and « date » (ADR 0014, issue #482).
-- A select lists its choices on its definition, and a card stores the ids of
-- the ones it holds. A date is stored like a timeline's: days from the year 0
-- and a precision. Both live in the JSON of `property_values`.
-- Never edit a merged migration: add a new file instead (CLAUDE.md).
--
-- SQLite cannot change a CHECK constraint: the table is made again, with its
-- rows. Dropping `property_definitions` would cascade to `property_values`
-- (foreign keys stay on during a migration), so that table is put aside and
-- made again too.

CREATE TABLE property_definitions_new (
    -- UUID v4.
    id                  TEXT PRIMARY KEY NOT NULL,
    type_id             TEXT REFERENCES card_types (id) ON DELETE CASCADE,
    card_id             TEXT REFERENCES cards (document_id) ON DELETE CASCADE,
    label               TEXT NOT NULL,
    kind                TEXT NOT NULL
                        CHECK (kind IN ('text', 'number', 'card', 'cards', 'select', 'date')),
    -- For links: the card types allowed as targets, JSON ([] = any).
    target_type_ids     TEXT NOT NULL DEFAULT '[]',
    -- For a type property: whether cards created before it show it too
    -- ("apply the changes to all the cards of this type?"). New cards
    -- always do.
    applies_to_existing INTEGER NOT NULL DEFAULT 0 CHECK (applies_to_existing IN (0, 1)),
    sort_order          INTEGER NOT NULL,
    -- RFC 3339.
    created_at          TEXT NOT NULL,
    -- A link's relation (ADR 0007).
    relation_type_id    TEXT REFERENCES relation_types (id) ON DELETE SET NULL,
    -- For a select: its choices in order, JSON ([{ "id", "label" }]).
    options             TEXT NOT NULL DEFAULT '[]',
    -- For a select: whether a card can hold several of them.
    multiple            INTEGER NOT NULL DEFAULT 0 CHECK (multiple IN (0, 1)),
    CHECK ((type_id IS NULL) <> (card_id IS NULL))
) STRICT;

INSERT INTO property_definitions_new (id, type_id, card_id, label, kind, target_type_ids,
                                      applies_to_existing, sort_order, created_at,
                                      relation_type_id)
    SELECT id, type_id, card_id, label, kind, target_type_ids, applies_to_existing, sort_order,
           created_at, relation_type_id
    FROM property_definitions;

CREATE TABLE property_values_kept (
    card_id     TEXT NOT NULL,
    property_id TEXT NOT NULL,
    value       TEXT NOT NULL
) STRICT;

INSERT INTO property_values_kept (card_id, property_id, value)
    SELECT card_id, property_id, value FROM property_values;

DROP TABLE property_values;
DROP TABLE property_definitions;
ALTER TABLE property_definitions_new RENAME TO property_definitions;

CREATE INDEX property_definitions_by_type ON property_definitions (type_id, sort_order);
CREATE INDEX property_definitions_by_card ON property_definitions (card_id, sort_order);

-- A card's value for a property: a `PropertyValue` as JSON.
CREATE TABLE property_values (
    card_id     TEXT NOT NULL REFERENCES cards (document_id) ON DELETE CASCADE,
    property_id TEXT NOT NULL REFERENCES property_definitions (id) ON DELETE CASCADE,
    value       TEXT NOT NULL,
    PRIMARY KEY (card_id, property_id)
) STRICT;

CREATE INDEX property_values_by_property ON property_values (property_id);

INSERT INTO property_values (card_id, property_id, value)
    SELECT card_id, property_id, value FROM property_values_kept;

DROP TABLE property_values_kept;
