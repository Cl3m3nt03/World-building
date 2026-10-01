import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type AssetFilter, commands } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";
import { mediaKeys } from "./keys";

/** Query keys of the library shared by the worlds (ADR 0006). */
export const libraryKeys = {
  all: () => ["library"] as const,
  list: (filter: AssetFilter) => [...libraryKeys.all(), "list", filter] as const,
};

/** Assets of the library, newest first; loaded while `enabled`. */
export function useLibraryAssets(filter: AssetFilter, enabled = true) {
  return useQuery({
    queryKey: libraryKeys.list(filter),
    queryFn: () => unwrap(commands.listLibraryAssets(filter)),
    enabled,
  });
}

/** Copies a file of the PC into the library. */
export function useImportLibraryAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (path: string) => unwrap(commands.importLibraryAsset(path)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: libraryKeys.all() }),
  });
}

/** Copies assets of the open world into the library, with their names. */
export function useAddToLibrary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => unwrap(commands.addAssetsToLibrary(ids)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: libraryKeys.all() }),
  });
}

export function useRenameLibraryAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      unwrap(commands.renameLibraryAsset(id, name)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: libraryKeys.all() }),
  });
}

/** Removes an asset from the library; the worlds keep their copies. */
export function useRemoveLibraryAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(commands.removeLibraryAsset(id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: libraryKeys.all() }),
  });
}

/** Copies a library asset into the open world; resolves to the world's asset. */
export function usePickFromLibrary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(commands.pickLibraryAsset(id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: mediaKeys.all() }),
  });
}
