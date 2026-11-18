import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { type CardType, commands } from "@/lib/bindings";
import { loadAfterSaves, trackSave } from "@/lib/contentSaves";
import { unwrap } from "@/lib/ipc";
import { cardKeys, documentKeys } from "../hooks/keys";
import { type Block, parseContent } from "./model";
import { effectiveTemplate, templateBlocks } from "./template";

/** Cache key of a card's blocks. */
export const cardContentKey = (cardId: string) => [...cardKeys.detail(cardId), "content"] as const;

/** A card's blocks (shared with the card route's loader). */
export const cardContentQuery = (cardId: string) => ({
  queryKey: cardContentKey(cardId),
  // Never read under a save of the card in progress (#586).
  queryFn: () =>
    loadAfterSaves(`card:${cardId}`, async () =>
      parseContent(await unwrap(commands.getCardContent(cardId))),
    ),
  // The editor owns the blocks once loaded: no refetch under its feet.
  staleTime: Number.POSITIVE_INFINITY,
  refetchOnWindowFocus: false,
});

export function useCardContent(cardId: string) {
  return useQuery(cardContentQuery(cardId));
}

/** Blocks to save, as written in the cache, and what they replaced there. */
type Save = { blocks: Block[]; written: Block[] | undefined; previous: Block[] | undefined };

/**
 * Saves a card's blocks. They are put in the cache as the save starts, not
 * once it is done: an editor saves on its way out, and the next editor of
 * the card (World ↔ Wiki) starts from the cache at once (#586). A failed
 * save puts back what was there, unless a later save has replaced it. The
 * saves of a card run one after the other, in the order they were sent.
 */
export function useSaveCardContent(cardId: string) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ blocks }: Save) =>
      unwrap(commands.setCardContent(cardId, JSON.stringify(blocks))),
    scope: { id: `card-content:${cardId}` },
    onError: (_, { written, previous }) => {
      const key = cardContentKey(cardId);
      if (queryClient.getQueryData(key) !== written) return;
      if (previous) queryClient.setQueryData(key, previous);
      else void queryClient.invalidateQueries({ queryKey: key, exact: true });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...documentKeys.all(), "backlinks"] });
    },
  });
  const { mutateAsync } = mutation;
  const save = useCallback(
    (blocks: Block[]) => {
      const key = cardContentKey(cardId);
      const previous = queryClient.getQueryData<Block[]>(key);
      const written = queryClient.setQueryData<Block[]>(key, blocks);
      return trackSave(`card:${cardId}`, mutateAsync({ blocks, written, previous }));
    },
    [cardId, queryClient, mutateAsync],
  );
  return { save, isError: mutation.isError, error: mutation.error };
}

/**
 * Gives a new card its type's guided template at once (V2-3.5): one titled
 * text block per section, saved as the card's content, unless the type has
 * "Apply the template on creation" off. A type without a template (nor a
 * parent's to inherit) leaves the card empty. Only for a card just
 * created: its content is replaced, and a new card has none.
 */
export function useStartFromTemplate() {
  const queryClient = useQueryClient();
  return async (cardId: string, type: CardType, types: CardType[]) => {
    if (!type.templateOnCreate) return;
    const blocks = templateBlocks([], effectiveTemplate(type, types));
    if (blocks.length === 0) return;
    await unwrap(commands.setCardContent(cardId, JSON.stringify(blocks)));
    queryClient.setQueryData(cardContentKey(cardId), blocks);
  };
}
