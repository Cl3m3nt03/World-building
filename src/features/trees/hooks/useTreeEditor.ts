import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { commands, type RelationTree, type VariantContent } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";
import { usePendingSave } from "@/lib/pendingSaves";
import { treeKeys } from "./useTrees";

/** Delay of inactivity before a change of a variant is saved. */
const SAVE_DELAY_MS = 600;

/**
 * The variants of an open tree while they are edited: every change shows at
 * once and is saved after a short pause (the variant's whole content,
 * `save_tree_variant`), when the tree is left and before the world or the
 * window closes. Each variant saves on its own.
 */
export function useTreeEditor(tree: RelationTree) {
  const queryClient = useQueryClient();
  const initial = () =>
    Object.fromEntries(tree.variants.map((variant) => [variant.id, variant.content]));
  const [contents, setContents] = useState<Record<string, VariantContent>>(initial);
  const current = useRef(contents);
  const pending = useRef(new Map<string, VariantContent>());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const saving = useRef<Promise<unknown> | undefined>(undefined);
  const save = useMutation({
    mutationFn: ({ variantId, content }: { variantId: string; content: VariantContent }) =>
      unwrap(commands.saveTreeVariant(variantId, content)),
    onSuccess: (_, { variantId, content }) =>
      queryClient.setQueryData<RelationTree>(treeKeys.detail(tree.id), (old) =>
        old
          ? {
              ...old,
              variants: old.variants.map((variant) =>
                variant.id === variantId ? { ...variant, content } : variant,
              ),
            }
          : old,
      ),
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

  /** Applies `change` to the variant's latest content, shows it and saves it. */
  const update = useCallback(
    (variantId: string, change: (previous: VariantContent) => VariantContent) => {
      const previous = current.current[variantId];
      if (!previous) return;
      const next = change(previous);
      if (next === previous) return;
      current.current = { ...current.current, [variantId]: next };
      setContents(current.current);
      pending.current.set(variantId, next);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void flushRef.current(), SAVE_DELAY_MS);
    },
    [],
  );

  /** A variant added, removed or reordered outside the editor: its contents follow. */
  const resetVariants = useCallback((next: RelationTree) => {
    const merged: Record<string, VariantContent> = {};
    for (const variant of next.variants) {
      merged[variant.id] = current.current[variant.id] ?? variant.content;
    }
    current.current = merged;
    setContents(merged);
  }, []);

  return { contents, update, flush, resetVariants, error: save.error };
}
