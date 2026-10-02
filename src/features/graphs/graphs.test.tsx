// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { clearMocks, mockConvertFileSrc, mockIPC } from "@tauri-apps/api/mocks";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createAppRouter } from "@/app/router";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { DocumentTree, Graph, GraphData, WorldInfo } from "@/lib/bindings";
import { createQueryClient } from "@/lib/query";
import { DEFAULT_SETTINGS, resolveSettings } from "./settings";
import { createSimulationHost, type SimEvent } from "./simulation";

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
  schemaVersion: 11,
  createdAt: "2026-10-02T10:00:00Z",
  lastOpenedAt: "2026-10-02T10:00:00Z",
} satisfies WorldInfo;

const DATA: GraphData = {
  nodes: [
    { id: "aragorn", title: "Aragorn", typeId: null, imageAssetId: null },
    { id: "arwen", title: "Arwen", typeId: null, imageAssetId: null },
    { id: "gimli", title: "Gimli", typeId: null, imageAssetId: null },
  ],
  edges: [{ source: "aragorn", target: "arwen", weight: 2 }],
};

let calls: { command: string; payload: unknown }[];
let tree: DocumentTree;
let stored: Graph | null;
let data: GraphData;

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mockConvertFileSrc("windows");
  calls = [];
  stored = null;
  data = DATA;
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
      case "create_graph": {
        const { title } = payload as { title: string };
        stored = {
          id: "g1",
          title,
          config: { filters: {}, settings: {}, pinned: [], viewport: null },
        };
        tree = {
          folders: [],
          documents: [
            {
              id: "g1",
              kind: "graph",
              title,
              folderId: null,
              parentId: null,
              sortOrder: 0,
              pinnedOrder: null,
              createdAt: "2026-10-02T10:00:00Z",
              typeId: null,
              imageAssetId: null,
            },
          ],
        };
        return stored;
      }
      case "get_graph":
        return stored;
      case "graph_data":
        return data;
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

/** Picks `entry` in the sidebar's « New document » menu. */
async function newDocument(entry: string) {
  const trigger = await screen.findByRole("button", { name: "Nouveau document (map, graph…)" });
  await act(async () => {
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
  });
  fireEvent.click(await screen.findByRole("menuitem", { name: entry }));
}

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

test('"New graph" in the sidebar creates a graph showing every card, and opens it', async () => {
  const router = await renderAt("/world/demo/world");

  await newDocument("Nouveau graph");

  await waitFor(() => expect(router.state.location.pathname).toBe("/world/demo/world/graph/g1"));
  expect(calls).toContainEqual({ command: "create_graph", payload: { title: "Graph sans nom" } });
  expect(
    await screen.findByRole("img", { name: "Graph Graph sans nom : 3 cartes, 1 liens" }),
  ).toBeTruthy();
  expect(await screen.findByRole("treeitem", { name: "Graph sans nom" })).toBeTruthy();
  expect((screen.getByLabelText("Nom du graph") as HTMLInputElement).value).toBe("Graph sans nom");
});

test("the « Graph » tile of the empty workspace creates a graph too", async () => {
  const router = await renderAt("/world/demo/world");
  fireEvent.click(await screen.findByRole("button", { name: "Graph" }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/world/demo/world/graph/g1"));
});

test("a world without cards says how the graph builds itself", async () => {
  data = { nodes: [], edges: [] };
  stored = {
    id: "g1",
    title: "Vide",
    config: { filters: {}, settings: {}, pinned: [], viewport: null },
  };
  await renderAt("/world/demo/world/graph/g1");
  expect(await screen.findByText(/le graph se construit tout seul/)).toBeTruthy();
});

test("settings missing from a saved graph take their default value", () => {
  expect(resolveSettings({})).toEqual(DEFAULT_SETTINGS);
  expect(resolveSettings({ repulsion: 400, nodeSize: null })).toEqual({
    ...DEFAULT_SETTINGS,
    repulsion: 400,
  });
});

// The simulation runs on animation frames (about 300 steps): give it time.
test("the simulation spreads the nodes, keeps a pinned node in place and settles", {
  timeout: 30_000,
}, async () => {
  const events: SimEvent[] = [];
  const handle = createSimulationHost((event) => events.push(event));
  handle({
    type: "init",
    nodes: [
      { id: "a", radius: 14 },
      { id: "b", radius: 14 },
      { id: "c", radius: 14, fx: 100, fy: -50 },
    ],
    links: [
      { source: "a", target: "b", weight: 1 },
      { source: "b", target: "missing", weight: 1 },
    ],
    settings: DEFAULT_SETTINGS,
  });
  await waitFor(() => expect(events.at(-1)?.settled).toBe(true), { timeout: 25_000 });
  const last = events.at(-1)?.positions as Float32Array;
  const [ax, ay, bx, by, cx, cy] = Array.from(last);
  // Two linked nodes do not overlap; the pinned one has not moved.
  expect(
    Math.hypot((ax as number) - (bx as number), (ay as number) - (by as number)),
  ).toBeGreaterThan(20);
  expect([cx, cy]).toEqual([100, -50]);

  // A change of settings moves the free nodes, never the pinned one.
  const before = events.length;
  handle({ type: "settings", settings: { ...DEFAULT_SETTINGS, repulsion: 1500 } });
  await waitFor(() => expect(events.length).toBeGreaterThan(before + 5));
  const after = Array.from(events.at(-1)?.positions as Float32Array);
  expect([after[4], after[5]]).toEqual([100, -50]);
  handle({ type: "stop" });
});
