import { useMutation, useQueryClient } from "@tanstack/react-query";
import { commands } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";
import { appKeys } from "./keys";

/** Sets (path) or resets (`null`) the folder proposed for new worlds. */
export function useSetDefaultWorldsDir() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (path: string | null) => unwrap(commands.setDefaultWorldsDir(path)),
    onSuccess: (settings) => {
      queryClient.setQueryData(appKeys.settings(), settings);
    },
  });
}
