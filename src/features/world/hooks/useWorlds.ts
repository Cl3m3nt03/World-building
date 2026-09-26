import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { appKeys } from "@/features/settings";
import { commands, type Genre, type WorldInfo } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";
import { worldKeys } from "./keys";

export const currentWorldQuery = {
  queryKey: worldKeys.current(),
  queryFn: () => unwrap(commands.currentWorld()),
};

/** The world open on the Rust side, or `null`. */
export function useCurrentWorld() {
  return useQuery(currentWorldQuery);
}

function onWorldOpened(queryClient: QueryClient, world: WorldInfo) {
  queryClient.setQueryData(worldKeys.current(), world);
  // Opening a world updates the recent worlds.
  void queryClient.invalidateQueries({ queryKey: appKeys.settings() });
}

/** Creates a world, opens it and navigates to its Home tab. */
export function useCreateWorld() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: ({ parentDir, name, genre }: { parentDir: string; name: string; genre: Genre }) =>
      unwrap(commands.createWorld(parentDir, name, genre)),
    onSuccess: async (world) => {
      onWorldOpened(queryClient, world);
      await navigate({ to: "/world/$worldId/home", params: { worldId: world.id } });
    },
  });
}

/** Opens the world in a folder and navigates to its Home tab. */
export function useOpenWorld() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (path: string) => unwrap(commands.openWorld(path)),
    onSuccess: async (world) => {
      onWorldOpened(queryClient, world);
      await navigate({ to: "/world/$worldId/home", params: { worldId: world.id } });
    },
  });
}

/** Closes the open world and goes back to the world list. */
export function useCloseWorld() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: () => unwrap(commands.closeWorld()),
    onSuccess: async () => {
      queryClient.setQueryData(worldKeys.current(), null);
      await navigate({ to: "/" });
    },
  });
}
