/** State of a list shown under the caret (the "/" commands). */
export type ListState<T> = {
  open: boolean;
  items: T[];
  active: number;
  /** Where the typed character is on screen, to place the list under it. */
  rect: DOMRect | null;
};

/**
 * A tiny external store: TipTap's suggestion plugin writes to it from its
 * callbacks (outside React), the list component reads it with
 * `useSyncExternalStore`.
 */
export function createListStore<T>() {
  const closed: ListState<T> = { open: false, items: [], active: 0, rect: null };
  let state = closed;
  let pick: ((item: T) => void) | null = null;
  const listeners = new Set<() => void>();
  const set = (next: ListState<T>) => {
    state = next;
    for (const listener of listeners) listener();
  };

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    get: () => state,
    show(items: T[], rect: DOMRect | null, onPick: (item: T) => void) {
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
      if (state.open) set(closed);
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
    pick(index = state.active): boolean {
      const item = state.items[index];
      if (!state.open || item === undefined || !pick) return false;
      pick(item);
      return true;
    },
  };
}

export type ListStore<T> = ReturnType<typeof createListStore<T>>;
