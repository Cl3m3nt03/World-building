import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useUiStore } from "@/app/stores/ui";
import { appKeys } from "@/features/settings";
import { commands, type Genre, type WorldInfo, type WorldPatch } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";
import { thumbnailsChanged } from "../thumbnails";
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

/**
 * Deletes the open world (its folder goes to the Windows recycle bin) and
 * goes back to the world list. If it fails, the Rust opens the world again;
 * should that fail too, the app goes back to the world list.
 */
export function useDeleteWorld() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: () => unwrap(commands.deleteWorld()),
    onSuccess: async (settings) => {
      // The settings screen it was deleted from must not reopen with the next world.
      useUiStore.getState().closeWorldSettings();
      queryClient.setQueryData(appKeys.settings(), settings);
      queryClient.setQueryData(worldKeys.current(), null);
      void queryClient.invalidateQueries({ queryKey: worldKeys.missing() });
      await navigate({ to: "/" });
    },
    onError: async () => {
      const world = await queryClient.fetchQuery({ ...currentWorldQuery, staleTime: 0 });
      if (!world) await navigate({ to: "/" });
    },
  });
}

function onWorldUpdated(queryClient: QueryClient, world: WorldInfo) {
  queryClient.setQueryData(worldKeys.current(), world);
  // Name, genre and thumbnail are shown in the world list.
  void queryClient.invalidateQueries({ queryKey: appKeys.settings() });
}

/** Saves changes to the name, genre or description of the open world. */
export function useUpdateWorld() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: WorldPatch) => unwrap(commands.updateWorld(patch)),
    onSuccess: (world) => onWorldUpdated(queryClient, world),
  });
}

/** Sets (asset id) or clears (`null`) the main image of the open world. */
export function useSetWorldMainImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assetId: string | null) => unwrap(commands.setWorldMainImage(assetId)),
    onSuccess: (world) => {
      thumbnailsChanged();
      onWorldUpdated(queryClient, world);
    },
  });
}
