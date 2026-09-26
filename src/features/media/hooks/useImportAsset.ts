import { useMutation, useQueryClient } from "@tanstack/react-query";
import { commands } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";
import { mediaKeys } from "./keys";

/** Imports a file from the PC into the open world's media library. */
export function useImportAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (path: string) => unwrap(commands.importAsset(path)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: mediaKeys.all() }),
  });
}

/** Imports raw content (an image pasted from the clipboard) under `name`. */
export function useImportAssetData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, data }: { name: string; data: number[] }) =>
      unwrap(commands.importAssetData(name, data)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: mediaKeys.all() }),
  });
}
