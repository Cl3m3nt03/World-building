-- Sidebar search (M3 step 3.7, docs/features/02-organisation.md): a full
-- text index of every document's name, aliases and content text.
-- Never edit a merged migration: add a new file instead (CLAUDE.md).
--
-- `remove_diacritics 2` and the default case folding make "elfe" find
-- "Elfé". Triggers keep the index in step with `documents` and `cards`,
-- whatever command writes them; trashed documents stay indexed and are
-- left out by the search query.

CREATE VIRTUAL TABLE search USING fts5 (
    document_id UNINDEXED,
    title,
    -- The card's aliases, as stored (JSON array): brackets and quotes are
    -- separators for the tokenizer.
    aliases,
    -- `cards.content_text`.
    content,
    tokenize = 'unicode61 remove_diacritics 2'
);

-- Worlds made before M3 step 3.7: every document indexed once.
INSERT INTO search (document_id, title, aliases, content)
SELECT d.id, d.title, COALESCE(c.aliases, ''), COALESCE(c.content_text, '')
FROM documents AS d LEFT JOIN cards AS c ON c.document_id = d.id;

CREATE TRIGGER search_document_added AFTER INSERT ON documents BEGIN
    INSERT INTO search (document_id, title, aliases, content) VALUES (new.id, new.title, '', '');
END;

CREATE TRIGGER search_document_renamed AFTER UPDATE OF title ON documents BEGIN
    UPDATE search SET title = new.title WHERE document_id = new.id;
END;

CREATE TRIGGER search_document_deleted AFTER DELETE ON documents BEGIN
    DELETE FROM search WHERE document_id = old.id;
END;

CREATE TRIGGER search_card_added AFTER INSERT ON cards BEGIN
    UPDATE search SET aliases = new.aliases, content = new.content_text
    WHERE document_id = new.document_id;
END;

CREATE TRIGGER search_card_changed AFTER UPDATE OF aliases, content_text ON cards BEGIN
    UPDATE search SET aliases = new.aliases, content = new.content_text
    WHERE document_id = new.document_id;
END;
