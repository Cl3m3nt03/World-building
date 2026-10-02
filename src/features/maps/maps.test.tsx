// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { clearMocks, mockConvertFileSrc, mockIPC } from "@tauri-apps/api/mocks";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createAppRouter } from "@/app/router";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Asset, DocumentTree, WorldInfo, Map as WorldMap } from "@/lib/bindings";
import { documentRoute } from "@/lib/documentRoute";
import { createQueryClient } from "@/lib/query";

const WORLD = {
  id: "demo",
  name: "Arda",
  path: "C:/Worlds/Arda",
  genre: "fantasy",
  description: "",
  mainImage: null,
  theme: { kind: "default" },
  preferences: { entityDetection: true, autoMentionLinks: true, animateNewLinks: true },
  storageLimit: null,
  schemaVersion: 10,
  createdAt: "2026-10-02T10:00:00Z",
  lastOpenedAt: "2026-10-02T10:00:00Z",
} satisfies WorldInfo;

const IMAGE: Asset = {
  id: `${"a".repeat(64)}.png`,
  name: "Terre du Milieu.png",
  kind: "image",
  mime: "image/png",
  size: 4096,
  width: 2000,
  height: 1500,
  createdAt: "2026-10-02T10:00:00Z",
};

function map(title: string): WorldMap {
  return {
    id: "m1",
    title,
    backgroundAssetId: IMAGE.id,
    width: 2000,
    height: 1500,
    content: {
      layers: [{ id: "l1", name: "Calque 1", visible: true }],
      pins: [],
      zones: [],
      texts: [],
    },
  };
}

let calls: { command: string; payload: unknown }[];
let tree: DocumentTree;
let stored: WorldMap | null;

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mockConvertFileSrc("windows");
  calls = [];
  stored = null;
  tree = { folders: [], documents: [] };
  mockIPC((command, payload) => {
    calls.push({ command, payload });
    switch (command) {
      case "current_world":
        return WORLD;
      case "get_sidebar_state":
        return {};
      case "document_tree":
        return tree;
      case "list_assets":
        return [IMAGE];
      case "create_map": {
        const { title } = payload as { title: string };
        stored = map(title);
        return stored;
      }
      case "get_map":
        return stored;
      case "rename_document": {
        const { title } = payload as { title: string };
        if (stored) stored = { ...stored, title };
        return null;
      }
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

async function renderAt(path: string) {
  const queryClient = createQueryClient();
  const router = createAppRouter(queryClient, createMemoryHistory({ initialEntries: [path] }));
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
  return router;
}

test("documents open on the page of their kind", () => {
  expect(documentRoute("w", "map", "m1")).toEqual({
    to: "/world/$worldId/world/map/$mapId",
    params: { worldId: "w", mapId: "m1" },
  });
  expect(documentRoute("w", "card", "c1")).toEqual({
    to: "/world/$worldId/world/card/$cardId",
    params: { worldId: "w", cardId: "c1" },
  });
});

test('"New map" chooses a background, creates the map with one layer and opens it', async () => {
  const router = await renderAt("/world/demo/world");

  fireEvent.click(await screen.findByRole("button", { name: "Nouvelle map" }));
  expect(
    await screen.findByRole("dialog", { name: "Image de fond de la nouvelle map" }),
  ).toBeTruthy();
  fireEvent.click(await screen.findByRole("option", { name: "Terre du Milieu.png" }));
  fireEvent.click(screen.getByRole("button", { name: "Choisir" }));

  await waitFor(() => expect(router.state.location.pathname).toBe("/world/demo/world/map/m1"));
  expect(calls).toContainEqual({
    command: "create_map",
    payload: { title: "Map sans nom", backgroundAssetId: IMAGE.id, layerName: "Calque 1" },
  });
  expect(await screen.findByRole("application", { name: "Map Map sans nom" })).toBeTruthy();
});

test("a map shows its name, renamed as typed, and can be recentered", async () => {
  stored = map("Arda");
  await renderAt("/world/demo/world/map/m1");

  const title = await screen.findByLabelText("Nom de la map");
  expect((title as HTMLInputElement).value).toBe("Arda");
  expect(screen.getByRole("button", { name: "Recentrer" })).toBeTruthy();
  expect(calls).toContainEqual({ command: "mark_document_opened", payload: { id: "m1" } });

  fireEvent.change(title, { target: { value: "Terre du Milieu" } });
  fireEvent.blur(title);
  await waitFor(() =>
    expect(calls).toContainEqual({
      command: "rename_document",
      payload: { id: "m1", title: "Terre du Milieu" },
    }),
  );
});

test("a map whose background was deleted says so", async () => {
  stored = { ...map("Arda"), backgroundAssetId: null };
  await renderAt("/world/demo/world/map/m1");
  expect(
    await screen.findByText("L'image de fond de cette map n'est plus dans la médiathèque."),
  ).toBeTruthy();
});
