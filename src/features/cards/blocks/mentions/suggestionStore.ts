import type { MentionSuggestion } from "./search";

/** State of the "@" suggestion list of one text block. */
export type SuggestionState = {
  open: boolean;
  items: MentionSuggestion[];
  active: number;
  /** Where the "@" is on screen, to place the list under it. */
  rect: DOMRect | null;
};

const CLOSED: SuggestionState = { open: false, items: [], active: 0, rect: null };

/**
 * A tiny external store: TipTap's suggestion plugin writes to it from its
 * callbacks (outside React), the list component reads it with
 * `useSyncExternalStore`.
 */
export function createSuggestionStore() {
  let state = CLOSED;
  let pick: ((item: MentionSuggestion) => void) | null = null;
  const listeners = new Set<() => void>();
  const set = (next: SuggestionState) => {
    state = next;
    for (const listener of listeners) listener();
  };

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    get: () => state,
    show(
      items: MentionSuggestion[],
      rect: DOMRect | null,
      onPick: (item: MentionSuggestion) => void,
    ) {
      pick = onPick;
      set({
        open: true,
        items,
        rect,
        active: Math.min(state.open ? state.active : 0, Math.max(items.length - 1, 0)),
      });
    },
    close() {
      pick = null;
      if (state.open) set(CLOSED);
    },
    /** Moves the highlighted item by `delta`, wrapping around. */
    move(delta: number) {
      if (!state.open || state.items.length === 0) return;
      const count = state.items.length;
      set({ ...state, active: (state.active + delta + count) % count });
    },
    setActive(index: number) {
      if (state.open) set({ ...state, active: index });
    },
    /** Picks the highlighted item (or `index`). Returns whether one was picked. */
    pick(index = state.active) {
      const item = state.items[index];
      if (!state.open || !item || !pick) return false;
      pick(item);
      return true;
    },
  };
}

export type SuggestionStore = ReturnType<typeof createSuggestionStore>;
