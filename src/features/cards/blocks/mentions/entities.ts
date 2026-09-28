import type { Card } from "@/lib/bindings";

/**
 * Names of the cards as they can be written in a text: titles and aliases.
 * Used by the entity detection and the automatic mention links (world
 * preferences, 2.18).
 */
export type EntityName = { card: Card; name: string; lower: string };

/** Shortest name looked for: one letter would match everywhere. */
export const MIN_NAME_LENGTH = 2;

const WORD_CHAR = /[\p{L}\p{N}_]/u;

/** A character that ends a word: space, punctuation, symbol… */
export function isBoundary(char: string | undefined): boolean {
  return char === undefined || char === "" || !WORD_CHAR.test(char);
}

function lower(text: string): string {
  return text.toLocaleLowerCase();
}

/**
 * The names (titles and aliases) of `cards`, longest first, the card being
 * edited left out. A name shared by two cards is ambiguous: it is left out
 * too, rather than linking the wrong card.
 */
export function entityNames(cards: Card[], excludeId: string): EntityName[] {
  const byName = new Map<string, EntityName | null>();
  for (const card of cards) {
    if (card.id === excludeId) continue;
    for (const raw of [card.title, ...card.aliases]) {
      const name = raw.trim();
      if (name.length < MIN_NAME_LENGTH) continue;
      const key = lower(name);
      const known = byName.get(key);
      if (known === undefined) byName.set(key, { card, name, lower: key });
      else if (known !== null && known.card.id !== card.id) byName.set(key, null);
    }
  }
  return [...byName.values()]
    .filter((entry) => entry !== null)
    .sort((a, b) => b.name.length - a.name.length);
}

/** A name found in a text, from `from` (included) to `to` (excluded). */
export type Found = { from: number; to: number; entity: EntityName };

function matchesAt(text: string, index: number, entity: EntityName): boolean {
  const end = index + entity.name.length;
  return (
    end <= text.length && isBoundary(text[end]) && lower(text.slice(index, end)) === entity.lower
  );
}

/**
 * The names written in `text` as whole words (case ignored), the longest
 * one at each place, without overlaps. A name right after "@" is left out:
 * it is being typed as a mention.
 */
export function findEntities(text: string, names: EntityName[]): Found[] {
  if (names.length === 0) return [];
  const found: Found[] = [];
  let index = 0;
  while (index < text.length) {
    const startsWord = isBoundary(text[index - 1]) && text[index - 1] !== "@";
    const entity = startsWord ? names.find((name) => matchesAt(text, index, name)) : undefined;
    if (entity) {
      found.push({ from: index, to: index + entity.name.length, entity });
      index += entity.name.length;
    } else {
      index++;
    }
  }
  return found;
}

/**
 * The name that ends `text` exactly, as a whole word (the one just typed
 * before a space or a punctuation mark), the longest if several do.
 */
export function nameEndingText(text: string, names: EntityName[]): Found | null {
  for (const entity of names) {
    const from = text.length - entity.name.length;
    if (from < 0) continue;
    const before = text[from - 1];
    if (isBoundary(before) && before !== "@" && matchesAt(text, from, entity)) {
      return { from, to: text.length, entity };
    }
  }
  return null;
}

/** Whether a longer name starts with `found`'s name followed by `separator` ("Minas" + " " for "Minas Tirith"). */
function startsLongerName(found: Found, separator: string, names: EntityName[]): boolean {
  const prefix = found.entity.lower + lower(separator);
  return names.some((name) => name.lower.length > prefix.length && name.lower.startsWith(prefix));
}

/**
 * What a typed `separator` (space, punctuation) links in `before`, the text
 * typed so far, for the automatic mention links:
 * - the name that ends `before`, unless a longer name starts with it and
 *   this separator ("Minas" then a space, with a card "Minas Tirith"): it
 *   waits for the next word;
 * - else, a name that was waiting and that the last word did not complete
 *   ("Minas est": "Minas" is linked when the space after "est" is typed).
 */
export function nameToLink(before: string, separator: string, names: EntityName[]): Found | null {
  const found = nameEndingText(before, names);
  if (found) return startsLongerName(found, separator, names) ? null : found;

  let wordStart = before.length;
  while (wordStart > 0 && !isBoundary(before[wordStart - 1])) wordStart--;
  if (wordStart === before.length || wordStart === 0) return null;
  const waiting = nameEndingText(before.slice(0, wordStart - 1), names);
  const waitedOn = before[wordStart - 1] ?? "";
  return waiting && startsLongerName(waiting, waitedOn, names) ? waiting : null;
}
