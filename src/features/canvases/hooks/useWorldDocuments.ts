import { useQuery } from "@tanstack/react-query";
import { documentKeys } from "@/features/cards";
import { commands, type DocumentKind } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";

/** The world's live documents of a kind (they refresh with every document change). */
export function useWorldDocuments(kind: DocumentKind) {
  return useQuery({
    queryKey: [...documentKeys.all(), "kind", kind],
    queryFn: () => unwrap(commands.listDocuments({ kind, trashed: false })),
  });
}
