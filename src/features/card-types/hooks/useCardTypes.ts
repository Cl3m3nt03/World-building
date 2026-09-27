import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type CardTypePatch, commands, type NewCardType } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";
import { cardTypeKeys } from "./keys";

/** Card types of the open world: each type followed by its subtypes. */
export function useCardTypes() {
  return useQuery({
    queryKey: cardTypeKeys.list(),
    queryFn: () => unwrap(commands.listCardTypes()),
  });
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: cardTypeKeys.all() });
}

export function useCreateCardType() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (cardType: NewCardType) => unwrap(commands.createCardType(cardType)),
    onSuccess: invalidate,
  });
}

export function useUpdateCardType() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: CardTypePatch }) =>
      unwrap(commands.updateCardType(id, patch)),
    onSuccess: invalidate,
  });
}

export function useDuplicateCardType() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      unwrap(commands.duplicateCardType(id, name)),
    onSuccess: invalidate,
  });
}

export function useDeleteCardType() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, moveCardsTo }: { id: string; moveCardsTo: string | null }) =>
      unwrap(commands.deleteCardType(id, moveCardsTo)),
    onSuccess: invalidate,
  });
}
