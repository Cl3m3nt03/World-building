import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { propertyKeys } from "@/features/properties";
import { type Card, commands } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";
import { cardKeys, documentKeys } from "./keys";

export function useCard(id: string) {
  return useQuery({
    queryKey: cardKeys.detail(id),
    queryFn: () => unwrap(commands.getCard(id)),
  });
}

/** After a change: the card's cache is the new card, and document lists refresh. */
function useCardSaved() {
  const queryClient = useQueryClient();
  return (card: Card) => {
    queryClient.setQueryData(cardKeys.detail(card.id), card);
    void queryClient.invalidateQueries({ queryKey: documentKeys.all() });
  };
}

export function useCreateCard() {
  const saved = useCardSaved();
  return useMutation({
    mutationFn: ({ typeId, title }: { typeId: string; title: string }) =>
      unwrap(commands.createCard(typeId, title)),
    onSuccess: saved,
  });
}

export function useRenameCard(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (title: string) => unwrap(commands.renameDocument(id, title)),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: cardKeys.detail(id) }),
        queryClient.invalidateQueries({ queryKey: documentKeys.all() }),
      ]),
  });
}

export function useSetCardType(id: string) {
  const saved = useCardSaved();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (typeId: string) => unwrap(commands.setCardType(id, typeId)),
    onSuccess: (card) => {
      saved(card);
      void queryClient.invalidateQueries({ queryKey: propertyKeys.ofCard(id) });
    },
  });
}

export function useSetCardImage(id: string) {
  const saved = useCardSaved();
  return useMutation({
    mutationFn: (assetId: string | null) => unwrap(commands.setCardImage(id, assetId)),
    onSuccess: saved,
  });
}

export function useSetCardAliases(id: string) {
  const saved = useCardSaved();
  return useMutation({
    mutationFn: (aliases: string[]) => unwrap(commands.setCardAliases(id, aliases)),
    onSuccess: saved,
  });
}

export function useTrashCard(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(commands.trashDocument(id)),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: cardKeys.detail(id) }),
        queryClient.invalidateQueries({ queryKey: documentKeys.all() }),
      ]),
  });
}

/** Cards of the world (or of its trash), by title. */
export function useCardList(trashed: boolean) {
  return useQuery({
    queryKey: [...documentKeys.all(), "cards", trashed],
    queryFn: () => unwrap(commands.listCards(trashed)),
  });
}

/** Maps, graphs and trees of the world's trash (the trash lists them next to the cards). */
export function useTrashedMaps() {
  return useQuery({
    queryKey: [...documentKeys.all(), "trashed", "not-cards"],
    queryFn: async () =>
      (await unwrap(commands.listDocuments({ trashed: true }))).filter(
        (document) => document.kind !== "card",
      ),
  });
}

function useDocumentsChanged() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: documentKeys.all() }),
      queryClient.invalidateQueries({ queryKey: cardKeys.all() }),
    ]);
}

export function useRestoreDocument() {
  const changed = useDocumentsChanged();
  return useMutation({
    mutationFn: (id: string) => unwrap(commands.restoreDocument(id)),
    onSuccess: changed,
  });
}

export function useDeleteDocumentForever() {
  const changed = useDocumentsChanged();
  return useMutation({
    mutationFn: (id: string) => unwrap(commands.deleteDocument(id)),
    onSuccess: changed,
  });
}

export function useEmptyTrash() {
  const changed = useDocumentsChanged();
  return useMutation({
    mutationFn: () => unwrap(commands.emptyTrash()),
    onSuccess: changed,
  });
}

/** Documents opened most recently (Home). */
export function useRecentDocuments(limit: number) {
  return useQuery({
    queryKey: [...documentKeys.all(), "recent", limit],
    queryFn: () => unwrap(commands.recentDocuments(limit)),
  });
}

/** Number of live cards per type or subtype (Home summary). */
export function useCardCounts() {
  return useQuery({
    queryKey: [...documentKeys.all(), "countByType"],
    queryFn: () => unwrap(commands.countCardsByType()),
  });
}

/** Records the opening of a document once per id (recent documents). */
export function useMarkOpened(id: string) {
  const queryClient = useQueryClient();
  useEffect(() => {
    commands
      .markDocumentOpened(id)
      .then(() => queryClient.invalidateQueries({ queryKey: [...documentKeys.all(), "recent"] }))
      .catch((error: unknown) => console.warn("Cannot record the opening", error));
  }, [id, queryClient]);
}
