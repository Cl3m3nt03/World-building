// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { clearMocks, mockConvertFileSrc, mockIPC } from "@tauri-apps/api/mocks";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createAppRouter } from "@/app/router";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { AppSettings, Asset, WorldInfo } from "@/lib/bindings";
import { createQueryClient } from "@/lib/query";
import { forgetWorldData } from "./hooks/useWorlds";

function world(id: string, name: string): WorldInfo {
  return {
    id,
    name,
    genre: "fantasy",
    description: "",
    mainImage: null,
    theme: { kind: "default" },
    preferences: { entityDetection: true, autoMentionLinks: true, animateNewLinks: true },
    path: `C:\\Mondes\\${name}`,
    schemaVersion: 6,
    createdAt: "2026-09-29T10:00:00Z",
    lastOpenedAt: "2026-09-29T10:00:00Z",
  };
}

const WESTEROS = world("w-1", "Westeros");
const ARDA = world("w-2", "Arda");

const asset = (id: string): Asset => ({
  id: `${id.repeat(64)}.png`,
  name: `${id}.png`,
  kind: "image",
  mime: "image/png",
  size: 10,
  width: 1,
  height: 1,
  createdAt: "2026-09-29T10:00:00Z",
});

/** What the Rust has in each world. */
const FILES: Record<string, Asset[]> = {
  [WESTEROS.id]: [asset("a"), asset("b"), asset("c")],
  [ARDA.id]: [],
};

const SETTINGS: AppSettings = {
  preferences: {
    language: "fr",
    theme: "system",
    transparencyEffects: true,
    radioVolume: 70,
    radioMode: "loop",
  },
  recentWorlds: [ARDA, WESTEROS].map((w) => ({
    path: w.path,
    name: w.name,
    id: w.id,
    genre: w.genre,
    thumbnail: false,
    lastOpenedAt: w.lastOpenedAt,
  })),
  defaultWorldsDir: null,
};

let open: WorldInfo | null;

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mockConvertFileSrc("windows");
  open = WESTEROS;
  mockIPC((command, payload) => {
    switch (command) {
      case "current_world":
        return open;
      case "get_settings":
        return SETTINGS;
      case "missing_recent_worlds":
        return [];
      case "close_world":
        open = null;
        return null;
      case "open_world":
        open = (payload as { path: string }).path === ARDA.path ? ARDA : WESTEROS;
        return open;
      case "list_assets":
        return open ? FILES[open.id] : [];
      case "list_card_types":
      case "recent_documents":
      case "count_cards_by_type":
      case "list_cards":
        return [];
      default:
        return null;
    }
  });
});

afterEach(() => {
  cleanup();
  clearMocks();
  vi.restoreAllMocks();
});

test("another world never shows the previous world's data", async () => {
  const queryClient = createQueryClient();
  const router = createAppRouter(
    queryClient,
    createMemoryHistory({ initialEntries: [`/world/${WESTEROS.id}/home`] }),
  );
  await act(async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <RouterProvider router={router} />
        </TooltipProvider>
      </QueryClientProvider>,
    );
    await router.load();
  });
  expect(await screen.findByText("3 fichiers")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Mondes" }));
  fireEvent.click(await screen.findByRole("button", { name: "Ouvrir Arda" }));

  expect(await screen.findByRole("heading", { name: "Bienvenue dans Arda" })).toBeTruthy();
  expect(await screen.findByText("0 fichier")).toBeTruthy();
  expect(screen.queryByText("3 fichiers")).toBeNull();
});

test("forgetting a world keeps the app settings and the open world", () => {
  const queryClient = new QueryClient();
  queryClient.setQueryData(["app", "settings"], SETTINGS);
  queryClient.setQueryData(["world", "current"], WESTEROS);
  queryClient.setQueryData(["cards", "detail", "c1"], { title: "Jon" });
  queryClient.setQueryData(["media", "list", {}], FILES[WESTEROS.id]);
  queryClient.setQueryData(["cardTypes", "list"], []);
  queryClient.setQueryData(["documents", "recent"], []);

  forgetWorldData(queryClient);

  expect(
    queryClient
      .getQueryCache()
      .getAll()
      .map((q) => q.queryKey[0]),
  ).toEqual(["app", "world"]);
});
