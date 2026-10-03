import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { documentKeys } from "@/features/cards";
import { commands, type RelationTree, type VariantContent } from "@/lib/bindings";
import {
  type History,
  record,
  redo as redoStep,
  rewrite,
  startHistory,
  undo as undoStep,
} from "@/lib/history";
import { unwrap } from "@/lib/ipc";
import { usePendingSave } from "@/lib/pendingSaves";
import { treeKeys } from "./useTrees";

/**
 * A tree's cards and relations are links of the world (ADR 0007): « Cited
 * in » of the cards and the graph read them again.
 */
export function invalidateWorldLinks(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: [...documentKeys.all(), "backlinks"] });
  void queryClient.invalidateQueries({ queryKey: [...documentKeys.all(), "graph-data"] });
  void queryClient.invalidateQueries({ queryKey: [...documentKeys.all(), "known-relations"] });
}

/** Delay of inactivity before a change of a variant is saved. */
const SAVE_DELAY_MS = 600;

/**
 * The variants of an open tree while they are edited: every change shows at
 * once and is saved after a short pause (the variant's whole content,
 * `save_tree_variant`), when the tree is left and before the world or the
 * window closes. Each variant saves on its own and has its own undo / redo
 * history (bounded, `src/lib/history.ts`).
 */
export function useTreeEditor(tree: RelationTree) {
  const queryClient = useQueryClient();
  const initial = () =>
    Object.fromEntries(tree.variants.map((variant) => [variant.id, variant.content]));
  const [contents, setContents] = useState<Record<string, VariantContent>>(initial);
  const current = useRef(contents);
  const histories = useRef(
    new Map(tree.variants.map((variant) => [variant.id, startHistory(variant.content)])),
  );
  // What can be undone or redone, per variant (for the buttons).
  const [steps, setSteps] = useState<Record<string, { undo: boolean; redo: boolean }>>({});
  const pending = useRef(new Map<string, VariantContent>());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const saving = useRef<Promise<unknown> | undefined>(undefined);
  const save = useMutation({
    mutationFn: ({ variantId, content }: { variantId: string; content: VariantContent }) =>
      unwrap(commands.saveTreeVariant(variantId, content)),
    onSuccess: (_, { variantId, content }) => {
      queryClient.setQueryData<RelationTree>(treeKeys.detail(tree.id), (old) =>
        old
          ? {
              ...old,
              variants: old.variants.map((variant) =>
                variant.id === variantId ? { ...variant, content } : variant,
              ),
            }
          : old,
      );
      invalidateWorldLinks(queryClient);
    },
  });

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    const jobs = [...pending.current].map(([variantId, content]) =>
      // A failure is shown by the page (`error`).
      save.mutateAsync({ variantId, content }).catch(() => {}),
    );
    pending.current.clear();
    if (jobs.length > 0) saving.current = Promise.all(jobs);
    return saving.current;
  }, [save.mutateAsync]);
  usePendingSave(flush);
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => () => void flushRef.current(), []);

  const refreshSteps = useCallback((variantId: string) => {
    const history = histories.current.get(variantId);
    setSteps((previous) => ({
      ...previous,
      [variantId]: {
        undo: (history?.past.length ?? 0) > 0,
        redo: (history?.future.length ?? 0) > 0,
      },
    }));
  }, []);

  /** Shows `next` for the variant and saves it after a pause. */
  const show = useCallback((variantId: string, next: VariantContent) => {
    current.current = { ...current.current, [variantId]: next };
    setContents(current.current);
    pending.current.set(variantId, next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flushRef.current(), SAVE_DELAY_MS);
  }, []);

  /**
   * Applies `change` to the variant's latest content, shows it and saves it;
   * it can be undone. Changes of the same `group` close together (a text
   * moved with the arrows) make one step.
   */
  const update = useCallback(
    (
      variantId: string,
      change: (previous: VariantContent) => VariantContent,
      group: string | null = null,
    ) => {
      const previous = current.current[variantId];
      if (!previous) return;
      const next = change(previous);
      if (next === previous) return;
      const history = histories.current.get(variantId) ?? startHistory(previous);
      histories.current.set(variantId, record(history, next, Date.now(), group));
      show(variantId, next);
      refreshSteps(variantId);
    },
    [show, refreshSteps],
  );

  const move = useCallback(
    (variantId: string, step: <T>(history: History<T>) => History<T>) => {
      const before = histories.current.get(variantId);
      if (!before) return;
      const after = step(before);
      if (after === before) return;
      histories.current.set(variantId, after);
      show(variantId, after.present);
      refreshSteps(variantId);
    },
    [show, refreshSteps],
  );
  const undo = useCallback((variantId: string) => move(variantId, undoStep), [move]);
  const redo = useCallback((variantId: string) => move(variantId, redoStep), [move]);

  /**
   * Changes every variant and its whole history, without a step to undo (a
   * relation type deleted: no snapshot may name it any more).
   */
  const rewriteAll = useCallback(
    (change: (content: VariantContent) => VariantContent) => {
      for (const [variantId, history] of histories.current) {
        const next = rewrite(history, change);
        histories.current.set(variantId, next);
        if (next.present !== history.present) show(variantId, next.present);
      }
    },
    [show],
  );

  /** A variant added, removed or reordered outside the editor: its contents follow. */
  const resetVariants = useCallback((next: RelationTree) => {
    const merged: Record<string, VariantContent> = {};
    for (const variant of next.variants) {
      merged[variant.id] = current.current[variant.id] ?? variant.content;
      if (!histories.current.has(variant.id)) {
        histories.current.set(variant.id, startHistory(variant.content));
      }
    }
    for (const id of histories.current.keys()) {
      if (!(id in merged)) histories.current.delete(id);
    }
    current.current = merged;
    setContents(merged);
  }, []);

  return {
    contents,
    update,
    undo,
    redo,
    canUndo: (variantId: string) => steps[variantId]?.undo ?? false,
    canRedo: (variantId: string) => steps[variantId]?.redo ?? false,
    rewriteAll,
    flush,
    resetVariants,
    error: save.error,
  };
}
