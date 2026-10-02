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
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { createQueryClient } from "@/lib/query";
import { MapBlockView } from "./MapBlockView";
import { type MapBlock, parseContent } from "./model";

const ARDA = {
  id: "m1",
  title: "Arda",
  backgroundAssetId: `${"a".repeat(64)}.png`,
  width: 2000,
  height: 1500,
  content: {
    layers: [{ id: "l1", name: "Calque 1", visible: true }],
    pins: [
      {
        id: "p1",
        layerId: "l1",
        cardId: null,
        x: 0.5,
        y: 0.5,
        icon: "castle",
        color: "red",
        label: "Minas Tirith",
        size: 1,
      },
    ],
    zones: [],
    texts: [],
  },
};

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mockConvertFileSrc("windows");
  mockIPC((command) => {
    if (command === "list_documents") {
      return [
        {
          id: "m1",
          kind: "map",
          title: "Arda",
          createdAt: "",
          updatedAt: "",
          openedAt: null,
          trashedAt: null,
        },
      ];
    }
    if (command === "get_map") return ARDA;
    return null;
  });
});

afterEach(() => {
  cleanup();
  clearMocks();
  vi.restoreAllMocks();
});

async function renderBlock(block: MapBlock, onChange: (block: MapBlock) => void) {
  const root = createRootRoute({ component: Outlet });
  const world = createRoute({
    getParentRoute: () => root,
    path: "/world/$worldId",
    component: () => <MapBlockView block={block} label="Bloc map 1" onChange={onChange} />,
  });
  const router = createRouter({
    routeTree: root.addChildren([world]),
    history: createMemoryHistory({ initialEntries: ["/world/demo"] }),
  });
  await act(async () => {
    render(
      <QueryClientProvider client={createQueryClient()}>
        <TooltipProvider>
          <RouterProvider router={router} />
        </TooltipProvider>
      </QueryClientProvider>,
    );
    await router.load();
  });
}

test("a map block chooses a map of the world, then shows it read-only with a link", async () => {
  const onChange = vi.fn();
  await renderBlock({ id: "b", type: "map", mapId: null }, onChange);
  fireEvent.click(await screen.findByRole("combobox", { name: "Map à afficher" }));
  fireEvent.click(await screen.findByRole("option", { name: "Arda" }));
  expect(onChange).toHaveBeenCalledWith({ id: "b", type: "map", mapId: "m1" });
});

test("a chosen map shows with its pins, and opens", async () => {
  await renderBlock({ id: "b", type: "map", mapId: "m1" }, () => {});
  expect(await screen.findByRole("application", { name: "Map Arda" })).toBeTruthy();
  const link = await screen.findByRole("link", { name: "Ouvrir la map" });
  expect(link.getAttribute("href")).toBe("/world/demo/world/map/m1");
  await waitFor(() => expect(document.querySelector('[aria-label="Minas Tirith"]')).not.toBeNull());
  expect(parseContent(JSON.stringify([{ id: "b", type: "map", mapId: "" }]))).toEqual([
    { id: "b", type: "map", mapId: null },
  ]);
});
