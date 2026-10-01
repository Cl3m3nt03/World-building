import { useQuery } from "@tanstack/react-query";
import { documentKeys } from "@/features/cards";
import { commands } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";

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
