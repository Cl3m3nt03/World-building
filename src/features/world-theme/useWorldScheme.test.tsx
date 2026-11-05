// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { initTheme } from "@/app/theme";
import { worldKeys } from "@/features/world/hooks/keys";
import type { WorldInfo, WorldTheme } from "@/lib/bindings";
import { createQueryClient } from "@/lib/query";
import { themeScheme, useWorldScheme } from "./useWorldScheme";

const CUSTOM: WorldTheme = { kind: "custom", background: null, accent: "#5fcdc0" };
type World = { id: string; name: string; theme: WorldTheme };
const DARK: World = { id: "dark-world", name: "Crypte", theme: { ...CUSTOM, scheme: "dark" } };
const FOLLOWS: World = { id: "app-world", name: "Aldoria", theme: CUSTOM };

test("a theme's mode: « Toujours clair » or « Toujours sombre » of a custom theme, else none", () => {
  expect(themeScheme({ kind: "default" })).toBeNull();
  expect(themeScheme({ kind: "preset", id: "dawn" })).toBeNull();
  // The ambiances follow the app too (ADR 0015 §3).
  for (const id of ["grimoire", "station", "crypt"])
    expect(themeScheme({ kind: "preset", id })).toBeNull();
  expect(themeScheme(CUSTOM)).toBeNull();
  expect(themeScheme({ ...CUSTOM, scheme: "app" })).toBeNull();
  expect(themeScheme({ ...CUSTOM, scheme: "dark" })).toBe("dark");
  expect(themeScheme({ ...CUSTOM, scheme: "light" })).toBe("light");
  // A mode from a newer app follows the app.
  expect(themeScheme({ ...CUSTOM, scheme: "dusk" } as unknown as WorldTheme)).toBeNull();
});

// --- On <html> -------------------------------------------------------------

function Probe() {
  useWorldScheme();
  return <Outlet />;
}

async function renderApp(world: World | null) {
  mockIPC((command) => (command === "current_world" ? (world as unknown as WorldInfo) : null));
  const queryClient = createQueryClient();
  const rootRoute = createRootRoute({ component: Probe });
  const routeTree = rootRoute.addChildren([
    createRoute({ getParentRoute: () => rootRoute, path: "/" }),
    createRoute({ getParentRoute: () => rootRoute, path: "/world/$worldId" }),
  ]);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [world ? `/world/${world.id}` : "/"] }),
  });
  await act(async () =>
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
  );
  const show = (next: World | null) =>
    act(async () => {
      queryClient.setQueryData(worldKeys.current(), next);
      await router.navigate({ to: next ? `/world/${next.id}` : "/" });
    });
  return { queryClient, show };
}

afterEach(() => {
  cleanup();
  clearMocks();
  initTheme();
});

const root = document.documentElement;

test("a world in « Toujours sombre » shows in dark while the app is light", async () => {
  initTheme();
  expect(root.dataset.theme).toBe("light");
  const view = await renderApp(DARK);
  await waitFor(() => expect(root.dataset.theme).toBe("dark"));
  await view.show(null);
  expect(root.dataset.theme).toBe("light");
});

test("closing the world keeps its mode until the world list is shown", async () => {
  const { queryClient } = await renderApp(DARK);
  await waitFor(() => expect(root.dataset.theme).toBe("dark"));
  // The world is closed first, its page still on screen.
  act(() => queryClient.setQueryData(worldKeys.current(), null));
  expect(root.dataset.theme).toBe("dark");
});

test("switching to a world that follows the app takes the app's mode", async () => {
  const view = await renderApp(DARK);
  await waitFor(() => expect(root.dataset.theme).toBe("dark"));
  // The next world opens before its page replaces this one's.
  act(() => view.queryClient.setQueryData(worldKeys.current(), FOLLOWS));
  expect(root.dataset.theme).toBe("dark");
  await view.show(FOLLOWS);
  expect(root.dataset.theme).toBe("light");
  await view.show(DARK);
  expect(root.dataset.theme).toBe("dark");
});
