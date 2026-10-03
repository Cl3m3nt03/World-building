import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { type Canvas, commands } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";
import { usePendingSave } from "@/lib/pendingSaves";
import { canvasKeys } from "./useCanvases";

/** Delay of inactivity before a change of the canvas is saved. */
const SAVE_DELAY_MS = 800;

/** The scene as Excalidraw gives it (only what is saved is typed here). */
export type SceneElement = { id: string; isDeleted?: boolean; version?: number } & Record<
  string,
  unknown
>;

/** What of Excalidraw's state is kept with the canvas: where the view is. */
export type KeptState = { scrollX: number; scrollY: number; zoom: { value: number } };

/**
 * The open canvas while it is edited: each change of the scene or of the
 * view is saved after a short pause (the whole scene, `save_canvas`), when
 * the canvas is left and before the world or the window closes. Excalidraw
 * calls `onChange` very often (every pointer move): a change is noted only
 * when the scene's version or the view moved.
 */
export function useCanvasEditor(canvas: Canvas) {
  const queryClient = useQueryClient();
  const pending = useRef<{ elements: readonly SceneElement[]; state: string } | null>(null);
  // The version and view last noted; `null` until Excalidraw's first call
  // (it gives the scene as loaded: nothing to save).
  const last = useRef<{ version: number; state: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const save = useMutation({
    mutationFn: ({ scene, appState }: { scene: string; appState: string }) =>
      unwrap(commands.saveCanvas(canvas.id, scene, appState)),
    onSuccess: (_, { scene, appState }) =>
      queryClient.setQueryData<Canvas>(canvasKeys.detail(canvas.id), (old) =>
        old ? { ...old, scene, appState } : old,
      ),
  });

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    const next = pending.current;
    pending.current = null;
    if (!next) return undefined;
    // Deleted elements are not kept: Excalidraw's undo works within the session.
    const scene = JSON.stringify({ elements: next.elements.filter((e) => !e.isDeleted) });
    // A failure is shown by the page (`error`).
    return save.mutateAsync({ scene, appState: next.state }).catch(() => {});
  }, [save.mutateAsync]);
  usePendingSave(flush);
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => () => void flushRef.current(), []);

  /** For Excalidraw's `onChange`: notes a change and saves it after a pause. */
  const onChange = useCallback(
    (elements: readonly SceneElement[], version: number, view: KeptState) => {
      const state = JSON.stringify({
        scrollX: Math.round(view.scrollX),
        scrollY: Math.round(view.scrollY),
        zoom: { value: Math.round(view.zoom.value * 1000) / 1000 },
      });
      const previous = last.current;
      last.current = { version, state };
      if (!previous || (previous.version === version && previous.state === state)) return;
      pending.current = { elements, state };
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void flushRef.current(), SAVE_DELAY_MS);
    },
    [],
  );

  return { onChange, flush, error: save.error };
}
