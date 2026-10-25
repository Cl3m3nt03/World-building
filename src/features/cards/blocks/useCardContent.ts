import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type CardType, commands } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";
import { cardKeys, documentKeys } from "../hooks/keys";
import { type Block, parseContent } from "./model";
import { effectiveTemplate, templateBlocks } from "./template";

export function useCardContent(cardId: string) {
  return useQuery({
    queryKey: [...cardKeys.detail(cardId), "content"],
    queryFn: async () => parseContent(await unwrap(commands.getCardContent(cardId))),
    // The editor owns the blocks once loaded: no refetch under its feet.
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
  });
}

export function useSaveCardContent(cardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (blocks: Block[]) =>
      unwrap(commands.setCardContent(cardId, JSON.stringify(blocks))),
    onSuccess: (_, blocks) => {
      queryClient.setQueryData([...cardKeys.detail(cardId), "content"], blocks);
      void queryClient.invalidateQueries({ queryKey: [...documentKeys.all(), "backlinks"] });
    },
  });
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
    queryClient.setQueryData([...cardKeys.detail(cardId), "content"], blocks);
  };
}
