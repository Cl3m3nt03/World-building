import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { documentKeys } from "@/features/cards";
import { commands, type WikiSettings } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";

/**
 * The wiki's data (M8): its settings, and its pages (the cards and maps
 * marked visible). The pages hang under the documents: any change of a
 * card or a map reads them again.
 */
export const wikiKeys = {
  settings: () => ["wiki", "settings"] as const,
  pages: () => [...documentKeys.all(), "wiki-pages"] as const,
};

export function useWikiSettings() {
  return useQuery({
    queryKey: wikiKeys.settings(),
    queryFn: () => unwrap(commands.wikiSettings()),
  });
}

/** Saves the wiki's settings; the cache shows them at once. */
export function useSaveWikiSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings: WikiSettings) => unwrap(commands.saveWikiSettings(settings)),
    onMutate: (settings) => queryClient.setQueryData(wikiKeys.settings(), settings),
    onError: () => queryClient.invalidateQueries({ queryKey: wikiKeys.settings() }),
  });
}

export function useWikiPages() {
  return useQuery({
    queryKey: wikiKeys.pages(),
    queryFn: () => unwrap(commands.wikiPages()),
  });
}

/** Marks a card or a map « Visible dans le wiki », or not. */
export function useSetWikiVisible() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, visible }: { id: string; visible: boolean }) =>
      unwrap(commands.setWikiVisible(id, visible)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: documentKeys.all() }),
  });
}
