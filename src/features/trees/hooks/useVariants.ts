import { useMutation, useQueryClient } from "@tanstack/react-query";
import { commands, type RelationTree } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";
import { treeKeys } from "./useTrees";

type Editor = {
  /** Saves what waits (a copy starts from the saved content). */
  flush: () => Promise<unknown> | undefined;
  /** The variants changed outside the editor: its contents follow. */
  resetVariants: (tree: RelationTree) => void;
};

/**
 * Adds, renames, duplicates, moves and deletes the variants of tree
 * `treeId` (docs/features/05-relation-tree.md). The tree in the cache and
 * the editor's contents follow each change.
 */
export function useVariants(treeId: string, editor: Editor) {
  const queryClient = useQueryClient();
  const key = treeKeys.detail(treeId);
  const current = () => queryClient.getQueryData<RelationTree>(key);
  const set = (tree: RelationTree) => {
    queryClient.setQueryData(key, tree);
    editor.resetVariants(tree);
  };

  /** A copy of variant `copyOf` named `name`, right after it. */
  const add = useMutation({
    mutationFn: async ({ copyOf, name }: { copyOf: string; name: string }) => {
      await editor.flush();
      return unwrap(commands.addTreeVariant(copyOf, name));
    },
    onSuccess: set,
  });
  const rename = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      unwrap(commands.renameTreeVariant(id, name)),
    onSuccess: (_, { id, name }) => {
      const tree = current();
      if (tree) {
        set({
          ...tree,
          variants: tree.variants.map((v) => (v.id === id ? { ...v, name: name.trim() } : v)),
        });
      }
    },
  });
  const move = useMutation({
    mutationFn: ({ id, index }: { id: string; index: number }) =>
      unwrap(commands.moveTreeVariant(id, index)),
    onSuccess: (_, { id, index }) => {
      const tree = current();
      const moved = tree?.variants.find((v) => v.id === id);
      if (tree && moved) {
        const rest = tree.variants.filter((v) => v.id !== id);
        rest.splice(index, 0, moved);
        set({ ...tree, variants: rest });
      }
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => unwrap(commands.deleteTreeVariant(id)),
    onSuccess: (_, id) => {
      const tree = current();
      if (tree) set({ ...tree, variants: tree.variants.filter((v) => v.id !== id) });
    },
  });

  return {
    add,
    rename,
    move,
    remove,
    error: add.error ?? rename.error ?? move.error ?? remove.error,
  };
}
