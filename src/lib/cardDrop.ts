/**
 * A card of the sidebar dragged and dropped outside the tree (on a map,
 * M4 step 4.5): the tree sends this event on `window` with where it was
 * dropped; whatever is there takes it.
 */
export const CARD_DROP_EVENT = "bz-card-drop";
export type CardDropDetail = { cardId: string; clientX: number; clientY: number };

export function dropCard(detail: CardDropDetail): void {
  window.dispatchEvent(new CustomEvent<CardDropDetail>(CARD_DROP_EVENT, { detail }));
}
