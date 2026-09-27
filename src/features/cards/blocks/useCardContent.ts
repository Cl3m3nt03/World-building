import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { commands } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";
import { cardKeys, documentKeys } from "../hooks/keys";
import { type Block, parseContent } from "./model";

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
