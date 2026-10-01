import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { worldKeys } from "@/features/world/hooks/keys";
import { commands, type WorldInfo } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";
import { mediaKeys } from "./keys";
import { libraryKeys } from "./useLibrary";

/**
 * Space used by the open world and left on its disk. Under the media keys,
 * so an import or a deletion refreshes it.
 */
export function useWorldStorage() {
  return useQuery({
    queryKey: [...mediaKeys.all(), "storage"],
    queryFn: () => unwrap(commands.worldStorage()),
  });
}

/** Sets (or removes, with `null`) the open world's storage limit, in bytes. */
export function useSetStorageLimit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (limit: number | null) => unwrap(commands.setWorldStorageLimit(limit)),
    onSuccess: (world: WorldInfo) => {
      queryClient.setQueryData(worldKeys.current(), world);
      void queryClient.invalidateQueries({ queryKey: mediaKeys.all() });
    },
  });
}

/** Space used by the library shared by the worlds; loaded while `enabled`. */
export function useLibraryStorage(enabled = true) {
  return useQuery({
    queryKey: [...libraryKeys.all(), "storage"],
    queryFn: () => unwrap(commands.libraryStorage()),
    enabled,
  });
}
