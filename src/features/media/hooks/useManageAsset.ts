import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { commands } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";
import { mediaKeys } from "./keys";

/** Changes the name shown for an asset. */
export function useRenameAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      unwrap(commands.renameAsset(id, name)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: mediaKeys.all() }),
  });
}

/** Deletes an asset and its file (and clears it as main image if it was). */
export function useDeleteAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(commands.deleteAsset(id)),
    // The file can be shown anywhere (main image of the world, cards, blocks,
    // map backgrounds): everything loaded is fetched again.
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

/** Where an asset is used, loaded when `id` is set (before deleting it). */
export function useAssetUsages(id: string | null) {
  return useQuery({
    queryKey: [...mediaKeys.all(), "usages", id],
    queryFn: () => unwrap(commands.assetUsages(id ?? "")),
    enabled: id !== null,
    staleTime: 0,
  });
}
