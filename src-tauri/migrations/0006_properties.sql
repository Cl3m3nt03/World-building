-- Card properties (docs/features/01-cartes-et-types.md, "Propriétés").
-- Never edit a merged migration: add a new file instead (CLAUDE.md).

-- A property is defined either on a card type (every card of the type, and
-- of its subtypes, shows it) or on a single card.
CREATE TABLE property_definitions (
    -- UUID v4.
    id                  TEXT PRIMARY KEY NOT NULL,
    type_id             TEXT REFERENCES card_types (id) ON DELETE CASCADE,
    card_id             TEXT REFERENCES cards (document_id) ON DELETE CASCADE,
    label               TEXT NOT NULL,
    -- 'card' and 'cards' (links to cards) come with M2 step 2.8.
    kind                TEXT NOT NULL CHECK (kind IN ('text', 'number', 'card', 'cards')),
    -- For links: the card types allowed as targets, JSON ([] = any).
    target_type_ids     TEXT NOT NULL DEFAULT '[]',
    -- For a type property: whether cards created before it show it too
    -- ("apply the changes to all the cards of this type?"). New cards
    -- always do.
    applies_to_existing INTEGER NOT NULL DEFAULT 0 CHECK (applies_to_existing IN (0, 1)),
    sort_order          INTEGER NOT NULL,
    -- RFC 3339.
    created_at          TEXT NOT NULL,
    CHECK ((type_id IS NULL) <> (card_id IS NULL))
) STRICT;

CREATE INDEX property_definitions_by_type ON property_definitions (type_id, sort_order);
CREATE INDEX property_definitions_by_card ON property_definitions (card_id, sort_order);

-- A card's value for a property, JSON: a string, a number, a card id or a
-- list of card ids depending on the property's kind.
CREATE TABLE property_values (
    card_id     TEXT NOT NULL REFERENCES cards (document_id) ON DELETE CASCADE,
    property_id TEXT NOT NULL REFERENCES property_definitions (id) ON DELETE CASCADE,
    value       TEXT NOT NULL,
    PRIMARY KEY (card_id, property_id)
) STRICT;

CREATE INDEX property_values_by_property ON property_values (property_id);
