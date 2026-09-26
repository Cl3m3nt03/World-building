import { useMutation } from "@tanstack/react-query";
import { commands } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";

/** Imports a file from the PC into the open world's assets. */
export function useImportAsset() {
  return useMutation({
    mutationFn: (path: string) => unwrap(commands.importAsset(path)),
  });
}
