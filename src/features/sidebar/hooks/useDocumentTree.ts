import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { documentKeys } from "@/features/cards";
import { commands, type DocumentTree } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";
import { applyMove, type Move } from "../tree";

/**
 * Query key of the sidebar tree: under the documents' key, so every change
 * to a document (created, renamed, retyped, trashed…) refreshes it.
 */
export const treeKey = () => [...documentKeys.all(), "tree"] as const;

/** The world's folders and live documents, with their place and order. */
export function useDocumentTree() {
  return useQuery({
    queryKey: treeKey(),
    queryFn: () => unwrap(commands.documentTree()),
  });
}

/**
 * Moves a document or a folder. The sidebar shows the move at once
 * (`applyMove`), then takes the Rust's tree; a refused move goes back.
 */
export function useMoveInTree() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (move: Move) =>
      unwrap(
        move.kind === "document"
          ? commands.moveDocument(move.id, move.place, move.index)
          : commands.moveFolder(move.id, move.parentId, move.index),
      ),
    onMutate: async (move) => {
      await queryClient.cancelQueries({ queryKey: treeKey() });
      queryClient.setQueryData<DocumentTree>(treeKey(), (tree) => tree && applyMove(tree, move));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: documentKeys.all() }),
  });
}
