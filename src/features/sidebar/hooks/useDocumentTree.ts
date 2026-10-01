import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cardKeys, documentKeys } from "@/features/cards";
import { commands, type DocumentTree, type FolderDeletion, type FolderPatch } from "@/lib/bindings";
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

function useTreeChanged() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: documentKeys.all() });
}

/** Creates a folder at the end of `parentId` (the root when `null`). */
export function useCreateFolder() {
  const changed = useTreeChanged();
  return useMutation({
    mutationFn: ({ parentId, name }: { parentId: string | null; name: string }) =>
      unwrap(commands.createFolder(parentId, name, "folder")),
    onSuccess: changed,
  });
}

/** Renames a folder or changes its icon. */
export function useUpdateFolder() {
  const changed = useTreeChanged();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: FolderPatch }) =>
      unwrap(commands.updateFolder(id, patch)),
    onSuccess: changed,
  });
}

/** Deletes a folder, lifting its content to its place or trashing it. */
export function useDeleteFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, mode }: { id: string; mode: FolderDeletion }) =>
      unwrap(commands.deleteFolder(id, mode)),
    // Trashed documents leave the card lists and the trash changes too.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: documentKeys.all() }),
        queryClient.invalidateQueries({ queryKey: cardKeys.all() }),
      ]),
  });
}
