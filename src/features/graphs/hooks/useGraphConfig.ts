import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { commands, type Graph, type GraphConfig, type GraphViewport } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";
import { usePendingSave } from "@/lib/pendingSaves";
import { graphKeys } from "./useGraphs";

/** Delay of inactivity before a change of the configuration is saved. */
const SAVE_DELAY_MS = 600;

/**
 * The configuration of an open graph (filters, settings, pinned nodes,
 * framing): every change shows at once and is saved after a short pause,
 * when the graph is left and before the world or the window closes. The
 * framing changes often (each move of the view): it is saved the same way
 * without drawing the page again.
 */
export function useGraphConfig(graph: Graph) {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<GraphConfig>(graph.config);
  const current = useRef(graph.config);
  const pending = useRef<GraphConfig | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const saving = useRef<Promise<unknown> | undefined>(undefined);
  const save = useMutation({
    mutationFn: (next: GraphConfig) => unwrap(commands.saveGraph(graph.id, next)),
    onSuccess: (_, next) =>
      queryClient.setQueryData<Graph>(graphKeys.detail(graph.id), (old) =>
        old ? { ...old, config: next } : old,
      ),
  });

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    if (pending.current) {
      // A failure is shown by the page (`error`).
      saving.current = save.mutateAsync(pending.current).catch(() => {});
      pending.current = null;
    }
    return saving.current;
  }, [save.mutateAsync]);
  usePendingSave(flush);
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => () => void flushRef.current(), []);

  const schedule = useCallback((next: GraphConfig) => {
    current.current = next;
    pending.current = next;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flushRef.current(), SAVE_DELAY_MS);
  }, []);

  /** Applies `change` to the latest configuration, shows it and saves it. */
  const update = useCallback(
    (change: (previous: GraphConfig) => GraphConfig) => {
      const next = change(current.current);
      if (next === current.current) return;
      setConfig(next);
      schedule(next);
    },
    [schedule],
  );

  /** The framing moved (`null`: it fits the whole graph again). */
  const setViewport = useCallback(
    (viewport: GraphViewport | null) => schedule({ ...current.current, viewport }),
    [schedule],
  );

  return { config, update, setViewport, flush, error: save.error };
}
