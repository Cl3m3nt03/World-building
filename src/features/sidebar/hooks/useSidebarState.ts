import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import { commands, type SidebarState } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";
import { usePendingSave } from "@/lib/pendingSaves";

/**
 * Query key of the open world's sidebar state (ADR 0005). Not under the
 * documents' key: a document change must not reload it over what the user
 * just did. It is dropped with the rest when the world changes.
 */
export const sidebarStateKey = () => ["sidebarState"] as const;

/** The saved state, loaded before the World tab shows (its route's loader). */
export const sidebarStateQuery = {
  queryKey: sidebarStateKey(),
  queryFn: () => unwrap(commands.getSidebarState()),
};

/** Pause after the last change before saving, in milliseconds. */
const SAVE_DELAY_MS = 400;

/**
 * The sidebar's state (width, collapse, open folders, filters and sort),
 * saved per world. `update` changes it at once and saves it a moment later
 * (a dragged handle or a few folders opened in a row make one save); a
 * pending save is sent before the world or the window closes.
 */
export function useSidebarState() {
  const queryClient = useQueryClient();
  const state = useQuery(sidebarStateQuery);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef(false);

  const save = useCallback(() => {
    clearTimeout(timer.current);
    if (!pending.current) return undefined;
    pending.current = false;
    const current = queryClient.getQueryData<SidebarState>(sidebarStateKey());
    // A failure only loses the layout; nothing to show for it.
    return current ? commands.setSidebarState(current) : undefined;
  }, [queryClient]);
  usePendingSave(save);

  const update = useCallback(
    (patch: Partial<SidebarState> | ((current: SidebarState) => Partial<SidebarState>)) => {
      const current = queryClient.getQueryData<SidebarState>(sidebarStateKey());
      if (!current) return;
      // A function sees the latest state, even before a re-render (two
      // quick changes in a row).
      const change = typeof patch === "function" ? patch(current) : patch;
      queryClient.setQueryData<SidebarState>(sidebarStateKey(), { ...current, ...change });
      pending.current = true;
      clearTimeout(timer.current);
      timer.current = setTimeout(save, SAVE_DELAY_MS);
    },
    [queryClient, save],
  );

  return { state: state.data, error: state.error, update };
}
