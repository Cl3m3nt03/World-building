import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { type CardType, commands } from "@/lib/bindings";
import { loadAfterSaves, saveContent } from "@/lib/contentSaves";
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

/**
 * Saves a card's blocks. They are put in the cache as the save starts, not
 * once it is done: an editor saves on its way out, and the next editor of
 * the card (World ↔ Wiki) starts from the cache at once (#586). A failed
 * save puts back the last saved blocks, unless a later save has started
 * (see `saveContent`). The saves of a card run one after the other, in the
 * order they were sent.
 */
export function useSaveCardContent(cardId: string) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (blocks: Block[]) =>
      unwrap(commands.setCardContent(cardId, JSON.stringify(blocks))),
    scope: { id: `card-content:${cardId}` },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...documentKeys.all(), "backlinks"] });
      // The card's text is searched (sidebar and wiki): its words may have changed (#598).
      void queryClient.invalidateQueries({ queryKey: documentKeys.search() });
    },
  });
  const { mutateAsync } = mutation;
  const save = useCallback(
    (blocks: Block[]) => {
      const key = cardContentKey(cardId);
      return saveContent(
        `card:${cardId}`,
        blocks,
        {
          read: () => queryClient.getQueryData<Block[]>(key),
          write: (text) => queryClient.setQueryData<Block[]>(key, text),
          reload: () => void queryClient.invalidateQueries({ queryKey: key, exact: true }),
        },
        () => mutateAsync(blocks),
      );
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
    // The sections' titles are searched as the card's text (#598).
    void queryClient.invalidateQueries({ queryKey: documentKeys.search() });
  };
}
