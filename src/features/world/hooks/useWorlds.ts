import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useUiStore } from "@/app/stores/ui";
import { appKeys } from "@/features/settings";
import {
  commands,
  type Genre,
  type WorldInfo,
  type WorldPatch,
  type WorldPreferences,
  type WorldTheme,
} from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";
import { flushPendingSaves } from "@/lib/pendingSaves";
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

/** Query key roots that do not belong to a world: app settings and info, the open world. */
const APP_ROOTS: readonly unknown[] = [appKeys.all()[0], worldKeys.all()[0]];

/**
 * Forgets everything cached about the open world (cards, types, properties,
 * documents, media…) when it closes or another one opens. The keys of those
 * queries do not carry the world id, and their data never goes stale on its
 * own: kept, the next world would show the previous one's.
 */
export function forgetWorldData(queryClient: QueryClient) {
  queryClient.removeQueries({ predicate: (query) => !APP_ROOTS.includes(query.queryKey[0]) });
}

function onWorldOpened(queryClient: QueryClient, world: WorldInfo) {
  forgetWorldData(queryClient);
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
    mutationFn: async (path: string) => {
      // Opening a world closes the open one: its pending edits are saved first.
      await flushPendingSaves();
      return unwrap(commands.openWorld(path));
    },
    onSuccess: async (world) => {
      onWorldOpened(queryClient, world);
      await navigate({ to: "/world/$worldId/home", params: { worldId: world.id } });
    },
  });
}

/**
 * Closes the open world and goes back to the world list. Pending edits (text
 * typed less than a second ago) are saved first.
 */
export function useCloseWorld() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async () => {
      await flushPendingSaves();
      return unwrap(commands.closeWorld());
    },
    onSuccess: async () => {
      queryClient.setQueryData(worldKeys.current(), null);
      await navigate({ to: "/" });
      forgetWorldData(queryClient);
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
      forgetWorldData(queryClient);
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

/**
 * Shows `theme` at once, before it is saved: the current world is updated
 * in the cache only (a color being dragged in the picker).
 */
export function usePreviewWorldTheme() {
  const queryClient = useQueryClient();
  return (theme: WorldTheme) =>
    queryClient.setQueryData<WorldInfo | null>(worldKeys.current(), (world) =>
      world ? { ...world, theme } : world,
    );
}

/**
 * Sets the theme of the open world. It shows at once; if saving fails, the
 * saved theme comes back.
 */
export function useSetWorldTheme() {
  const queryClient = useQueryClient();
  const preview = usePreviewWorldTheme();
  return useMutation({
    mutationFn: (theme: WorldTheme) => unwrap(commands.setWorldTheme(theme)),
    onMutate: async (theme) => {
      await queryClient.cancelQueries({ queryKey: worldKeys.current() });
      preview(theme);
    },
    onSuccess: (world) => queryClient.setQueryData(worldKeys.current(), world),
    onError: () => queryClient.invalidateQueries({ queryKey: worldKeys.current() }),
  });
}

/**
 * Sets the writing preferences of the open world. They apply at once; if
 * saving fails, the saved ones come back.
 */
export function useSetWorldPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (preferences: WorldPreferences) =>
      unwrap(commands.setWorldPreferences(preferences)),
    onMutate: async (preferences) => {
      await queryClient.cancelQueries({ queryKey: worldKeys.current() });
      queryClient.setQueryData<WorldInfo | null>(worldKeys.current(), (world) =>
        world ? { ...world, preferences } : world,
      );
    },
    onSuccess: (world) => queryClient.setQueryData(worldKeys.current(), world),
    onError: () => queryClient.invalidateQueries({ queryKey: worldKeys.current() }),
  });
}
