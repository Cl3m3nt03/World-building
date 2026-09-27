import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  return useMutation({
    mutationFn: (typeId: string) => unwrap(commands.setCardType(id, typeId)),
    onSuccess: saved,
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
