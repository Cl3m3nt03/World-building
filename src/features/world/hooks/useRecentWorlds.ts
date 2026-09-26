import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { appKeys } from "@/features/settings";
import { type AppSettings, commands } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";
import { worldKeys } from "./keys";

/** Paths of the recent worlds whose folder no longer holds a world. */
export function useMissingWorlds() {
  return useQuery({
    queryKey: worldKeys.missing(),
    queryFn: () => unwrap(commands.missingRecentWorlds()),
    // Folders can move while the app is open: check again on each visit.
    staleTime: 0,
  });
}

function useSettingsMutation<T>(mutationFn: (input: T) => Promise<AppSettings>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (settings) => {
      queryClient.setQueryData(appKeys.settings(), settings);
      void queryClient.invalidateQueries({ queryKey: worldKeys.missing() });
    },
  });
}

/** Removes a world from the list; its folder is not touched. */
export function useRemoveRecentWorld() {
  return useSettingsMutation((path: string) => unwrap(commands.removeRecentWorld(path)));
}

/** Points a moved world to its new folder (must be the same world). */
export function useRelocateRecentWorld() {
  return useSettingsMutation(({ oldPath, newPath }: { oldPath: string; newPath: string }) =>
    unwrap(commands.relocateRecentWorld(oldPath, newPath)),
  );
}

/** Shows a world folder in the Windows Explorer. */
export function useRevealWorld() {
  return useMutation({
    mutationFn: (path: string) => unwrap(commands.revealInExplorer(path)),
  });
}
