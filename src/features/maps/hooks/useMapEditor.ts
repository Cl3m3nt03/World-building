import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { commands, type MapContent, type Map as WorldMap } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";
import { usePendingSave } from "@/lib/pendingSaves";
import { mapKeys } from "./useMaps";

/** Delay of inactivity before a change of the map is saved. */
const SAVE_DELAY_MS = 600;

/**
 * The content of an open map while it is edited: every change shows at
 * once and is saved after a short pause (whole content, `save_map`), and
 * before the world or the window closes. The layer that receives new items
 * is chosen here too.
 */
export function useMapEditor(map: WorldMap) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState<MapContent>(map.content);
  const [activeLayerId, setActiveLayerId] = useState<string>(map.content.layers.at(-1)?.id ?? "");
  // The latest content, so that changes made in a row apply to each other.
  const current = useRef(map.content);
  const pending = useRef<MapContent | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const saving = useRef<Promise<unknown> | undefined>(undefined);
  const save = useMutation({
    mutationFn: (next: MapContent) => unwrap(commands.saveMap(map.id, next)),
    onSuccess: (_, next) =>
      queryClient.setQueryData<WorldMap>(mapKeys.detail(map.id), (old) =>
        old ? { ...old, content: next } : old,
      ),
  });

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    if (pending.current) {
      // A failure is shown by the page (`save.error`).
      saving.current = save.mutateAsync(pending.current).catch(() => {});
      pending.current = null;
    }
    return saving.current;
  }, [save.mutateAsync]);
  usePendingSave(flush);
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => () => void flushRef.current(), []);

  const update = useCallback(
    (change: (previous: MapContent) => MapContent, immediately = false) => {
      const next = change(current.current);
      if (next === current.current) return;
      current.current = next;
      setContent(next);
      pending.current = next;
      clearTimeout(timer.current);
      if (immediately) void flushRef.current();
      else timer.current = setTimeout(() => void flushRef.current(), SAVE_DELAY_MS);
    },
    [],
  );

  // The active layer always exists.
  const activeLayer = content.layers.some((layer) => layer.id === activeLayerId)
    ? activeLayerId
    : (content.layers.at(-1)?.id ?? "");

  return { content, update, activeLayerId: activeLayer, setActiveLayerId, saveError: save.error };
}
