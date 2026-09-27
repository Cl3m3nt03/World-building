import type { Card } from "@/lib/bindings";

/** Most suggestions shown at once. */
export const MAX_SUGGESTIONS = 8;

/** A card offered after "@", and the alias that matched if its name did not. */
export type MentionSuggestion = { card: Card; alias: string | null };

/**
 * Cards whose name or one of whose aliases contains `query` (case and
 * accents ignored), names first, then by title. The card being edited is
 * left out.
 */
export function searchMentions(
  cards: Card[],
  query: string,
  excludeId: string,
): MentionSuggestion[] {
  const needle = normalize(query.trim());
  const byName: MentionSuggestion[] = [];
  const byAlias: MentionSuggestion[] = [];
  for (const card of cards) {
    if (card.id === excludeId) continue;
    if (needle === "" || normalize(card.title).includes(needle)) {
      byName.push({ card, alias: null });
      continue;
    }
    const alias = card.aliases.find((candidate) => normalize(candidate).includes(needle));
    if (alias) byAlias.push({ card, alias });
  }
  const byTitle = (a: MentionSuggestion, b: MentionSuggestion) =>
    a.card.title.localeCompare(b.card.title);
  return [...byName.sort(byTitle), ...byAlias.sort(byTitle)].slice(0, MAX_SUGGESTIONS);
}

/** Lower case without accents: "Élodie" and "elodie" match. */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase();
}
