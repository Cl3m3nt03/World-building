// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { clearMocks, mockConvertFileSrc, mockIPC } from "@tauri-apps/api/mocks";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createAppRouter } from "@/app/router";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { DocumentTree, Graph, GraphData, WorldInfo } from "@/lib/bindings";
import { createQueryClient } from "@/lib/query";
import { searchNodes } from "./search";
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
    { id: "aragorn", title: "Aragorn", typeId: null, imageAssetId: null, aliases: ["Grands-Pas"] },
    { id: "arwen", title: "Arwen", typeId: null, imageAssetId: null, aliases: [] },
    { id: "gimli", title: "Gimli", typeId: null, imageAssetId: null, aliases: ["Fils de Glóin"] },
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

test("the list of the shown cards: arrows select, the neighbours show, Enter opens the card", async () => {
  stored = {
    id: "g1",
    title: "Royaume",
    config: { filters: {}, settings: {}, pinned: [], viewport: null },
  };
  const router = await renderAt("/world/demo/world/graph/g1");
  const list = await screen.findByRole("listbox", { name: "3 cartes" });
  const options = () => within(list).getAllByRole("option");
  expect(options().map((option) => option.textContent)).toEqual(["Aragorn", "Arwen", "Gimli"]);

  await act(async () => {
    list.focus();
    fireEvent.keyDown(list, { key: "ArrowDown" });
  });
  // Nothing was selected: the first card is.
  expect(options()[0]?.getAttribute("aria-selected")).toBe("true");
  expect(list.getAttribute("aria-activedescendant")).toBe(options()[0]?.id);
  const linked = screen.getByRole("region", { name: "Cartes liées à Aragorn" });
  expect(
    within(linked)
      .getAllByRole("button")
      .map((b) => b.textContent),
  ).toEqual(["Arwen"]);

  fireEvent.keyDown(list, { key: "End" });
  expect(options()[2]?.getAttribute("aria-selected")).toBe("true");
  expect(screen.getByRole("region", { name: "Cartes liées à Gimli" }).textContent).toContain(
    "Aucun lien.",
  );

  fireEvent.click(options()[1] as HTMLElement);
  fireEvent.keyDown(list, { key: "Enter" });
  await waitFor(() => expect(router.state.location.pathname).toBe("/world/demo/world/card/arwen"));
});

test("the search finds cards by name or alias, without accents nor case", () => {
  const titles = (query: string) => searchNodes(DATA.nodes, query).map((node) => node.title);
  expect(titles("ar")).toEqual(["Aragorn", "Arwen"]);
  expect(titles("grands")).toEqual(["Aragorn"]);
  expect(titles("GLOIN")).toEqual(["Gimli"]);
  expect(titles("  ")).toEqual([]);
});

test("the magnifying glass opens a field; the count is announced; Escape closes it", async () => {
  stored = {
    id: "g1",
    title: "Royaume",
    config: { filters: {}, settings: {}, pinned: [], viewport: null },
  };
  await renderAt("/world/demo/world/graph/g1");
  const toolbar = await screen.findByRole("toolbar", { name: "Outils du graph" });
  fireEvent.click(within(toolbar).getByRole("button", { name: "Rechercher dans le graph" }));
  const field = screen.getByRole("searchbox", { name: "Rechercher une carte dans le graph" });
  expect(document.activeElement).toBe(field);
  fireEvent.change(field, { target: { value: "ar" } });
  expect(within(toolbar).getByText("2 cartes")).toBeTruthy();
  fireEvent.keyDown(field, { key: "Escape" });
  expect(screen.queryByRole("searchbox")).toBeNull();
  expect(document.activeElement).toBe(
    within(toolbar).getByRole("button", { name: "Rechercher dans le graph" }),
  );
});
