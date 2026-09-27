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
import { clearMocks, mockConvertFileSrc, mockIPC } from "@tauri-apps/api/mocks";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useUiStore } from "@/app/stores/ui";
import { TooltipProvider } from "@/components/ui/tooltip";
import { worldKeys } from "@/features/world";
import type { WorldInfo } from "@/lib/bindings";
import { createQueryClient } from "@/lib/query";
import { HomeScreen } from "./HomeScreen";

const WORLD: WorldInfo = {
  id: "demo",
  name: "Eldefleur",
  genre: "scienceFiction",
  description: "",
  mainImage: null,
  path: "C:\\Mondes\\Eldefleur",
  schemaVersion: 1,
  createdAt: "2026-09-26T10:00:00Z",
  lastOpenedAt: "2026-09-26T10:00:00Z",
};

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mockConvertFileSrc("windows");
  useUiStore.setState({ worldPanelOpen: false });
  mockIPC((command) => {
    if (command === "current_world") return WORLD;
    if (command === "list_assets") return [{ id: "a.png" }, { id: "b.mp3" }, { id: "c.png" }];
    return null;
  });
});

afterEach(() => {
  cleanup();
  clearMocks();
  vi.restoreAllMocks();
});

async function renderHome(world: WorldInfo = WORLD) {
  const queryClient = createQueryClient();
  queryClient.setQueryData(worldKeys.current(), world);
  const rootRoute = createRootRoute({ component: Outlet });
  const homeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/world/$worldId/home",
    component: HomeScreen,
  });
  const mediaRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/world/$worldId/media",
    component: () => null,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([homeRoute, mediaRoute]),
    history: createMemoryHistory({ initialEntries: [`/world/${world.id}/home`] }),
  });
  render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </QueryClientProvider>,
  );
  await router.load();
  return router;
}

test("welcomes to the open world and sums it up", async () => {
  await renderHome();

  expect(await screen.findByRole("heading", { name: "Bienvenue dans Eldefleur" })).toBeTruthy();
  expect(screen.getByText("Science-fiction")).toBeTruthy();
  expect(await screen.findByText("3 fichiers")).toBeTruthy();
  expect(screen.getByText(/La création de cartes arrive avec M2/)).toBeTruthy();
  expect(screen.getByText(/Il arrive avec M5/)).toBeTruthy();
});

test("the media library entry leads to the media library", async () => {
  const router = await renderHome();

  fireEvent.click(await screen.findByRole("link", { name: "Médiathèque" }));

  await vi.waitFor(() => expect(router.state.location.pathname).toBe("/world/demo/media"));
});

test("world settings and the description prompt open the world panel", async () => {
  await renderHome();

  fireEvent.click(await screen.findByRole("button", { name: "Réglages du monde" }));
  expect(useUiStore.getState().worldPanelOpen).toBe(true);

  useUiStore.setState({ worldPanelOpen: false });
  fireEvent.click(screen.getByRole("button", { name: "Ajouter une description…" }));
  expect(useUiStore.getState().worldPanelOpen).toBe(true);
});

test("types opens the card types screen; theme is marked unavailable", async () => {
  useUiStore.setState({ cardTypesOpen: false });
  await renderHome({ ...WORLD, description: "Un monde de canaux." });

  fireEvent.click(await screen.findByRole("button", { name: "Types" }));
  expect(useUiStore.getState().cardTypesOpen).toBe(true);
  expect(screen.getByRole("button", { name: "Thème" }).getAttribute("aria-disabled")).toBe("true");
  expect(screen.getByText("Un monde de canaux.")).toBeTruthy();
});
