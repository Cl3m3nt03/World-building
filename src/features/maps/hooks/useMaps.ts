import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { documentKeys } from "@/features/cards/hooks/keys";
import { commands } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";

/** Query keys of the maps (see the conventions in src/lib/query.ts). */
export const mapKeys = {
  all: () => ["maps"] as const,
  detail: (id: string) => [...mapKeys.all(), "detail", id] as const,
};

export function useMap(id: string) {
  return useQuery({
    queryKey: mapKeys.detail(id),
    queryFn: () => unwrap(commands.getMap(id)),
  });
}

/** Creates a map on an image of the media library (one layer, named by the front). */
export function useCreateMap() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      title,
      backgroundAssetId,
      layerName,
    }: {
      title: string;
      backgroundAssetId: string;
      layerName: string;
    }) => unwrap(commands.createMap(title, backgroundAssetId, layerName)),
    onSuccess: (map) => {
      queryClient.setQueryData(mapKeys.detail(map.id), map);
      void queryClient.invalidateQueries({ queryKey: documentKeys.all() });
    },
  });
}

export function useRenameMap(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (title: string) => unwrap(commands.renameDocument(id, title)),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: mapKeys.detail(id) }),
        queryClient.invalidateQueries({ queryKey: documentKeys.all() }),
      ]),
  });
}

/** Puts another image under the map; what is on it keeps its place. */
export function useSetMapBackground(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assetId: string) => unwrap(commands.setMapBackground(id, assetId)),
    onSuccess: (map) => {
      // Only the background and size: the editor owns the content.
      queryClient.setQueryData<typeof map>(mapKeys.detail(id), (old) =>
        old
          ? {
              ...old,
              backgroundAssetId: map.backgroundAssetId,
              width: map.width,
              height: map.height,
            }
          : map,
      );
    },
  });
}
