// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { clearMocks, mockConvertFileSrc, mockIPC } from "@tauri-apps/api/mocks";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createAppRouter } from "@/app/router";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Card, DocumentTree, Timeline, WorldInfo } from "@/lib/bindings";
import { createQueryClient } from "@/lib/query";

const YEAR = 360;

const WORLD = {
  id: "demo",
  name: "Westeros",
  path: "C:/Worlds/Westeros",
  genre: "fantasy",
  description: "",
  mainImage: null,
  theme: { kind: "default" },
  preferences: { entityDetection: true, autoMentionLinks: true, animateNewLinks: true },
  calendar: {
    eras: [
      { name: "Avant la Conquête", abbreviation: "av. AC", startYear: -12000, backwards: true },
      { name: "Après la Conquête", abbreviation: "AC", startYear: 0, backwards: false },
    ],
    months: Array.from({ length: 12 }, () => ({ name: "", days: 30 })),
  },
  storageLimit: null,
  schemaVersion: 20,
  createdAt: "2026-10-12T10:00:00Z",
  lastOpenedAt: "2026-10-12T10:00:00Z",
} satisfies WorldInfo;

const ROBERT = {
  id: "robert",
  title: "Robert Baratheon",
  aliases: [],
  typeId: null,
  imageAssetId: null,
} as unknown as Card;

const HISTORY: Timeline = {
  id: "tl1",
  title: "Histoire de Westeros",
  tracks: [
    { id: "wars", name: "Guerres", color: "red" },
    { id: "kings", name: "Rois", color: "amber" },
  ],
  items: [
    {
      id: "conquest",
      trackId: "wars",
      cardId: null,
      title: "Conquête d'Aegon",
      color: "red",
      description: "Trois dragons.",
      start: -2 * YEAR,
      end: 0,
      precision: "year",
    },
    {
      id: "rebellion",
      trackId: "wars",
      cardId: null,
      title: "Rébellion de Robert",
      color: "red",
      description: "",
      start: 282 * YEAR,
      end: 283 * YEAR,
      precision: "year",
    },
    {
      id: "crowned",
      trackId: "kings",
      cardId: "robert",
      title: "",
      color: "amber",
      description: "",
      start: 283 * YEAR + 30 * 2,
      end: null,
      precision: "month",
    },
  ],
};

let calls: { command: string; payload: unknown }[];
let tree: DocumentTree;
let stored: Timeline | null;

function document(timeline: Timeline) {
  return {
    id: timeline.id,
    kind: "timeline" as const,
    title: timeline.title,
    folderId: null,
    parentId: null,
    sortOrder: 0,
    pinnedOrder: null,
    createdAt: "2026-10-12T10:00:00Z",
    typeId: null,
    imageAssetId: null,
    wikiVisible: false,
  };
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mockConvertFileSrc("windows");
  // jsdom lays nothing out: the timeline's drawing is 1000 pixels wide.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private callback: ResizeObserverCallback) {}
      observe(target: Element) {
        if (target.getAttribute("role") !== "application") return;
        this.callback(
          [{ target, contentRect: { width: 1000, height: 400 } } as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        );
      }
      unobserve() {}
      disconnect() {}
    },
  );
  calls = [];
  stored = HISTORY;
  tree = { folders: [], documents: [document(HISTORY)] };
  mockIPC((command, payload) => {
    calls.push({ command, payload });
    switch (command) {
      case "current_world":
        return WORLD;
      case "get_sidebar_state":
        return {};
      case "document_tree":
        return tree;
      case "list_cards":
        return [ROBERT];
      case "list_card_types":
        return [];
      case "get_timeline":
        return stored;
      case "create_timeline": {
        const { title, trackName } = payload as { title: string; trackName: string };
        stored = {
          id: "tl2",
          title,
          tracks: [{ id: "t", name: trackName, color: "slate" }],
          items: [],
        };
        tree = { folders: [], documents: [document(stored)] };
        return stored;
      }
      default:
        return null;
    }
  });
});

afterEach(() => {
  cleanup();
  clearMocks();
  vi.unstubAllGlobals();
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

test('"New timeline" in the sidebar creates a timeline with one track, and opens it', async () => {
  tree = { folders: [], documents: [] };
  const router = await renderAt("/world/demo/world");

  const trigger = await screen.findByRole("button", { name: /^Nouveau document/ });
  await act(async () => {
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
  });
  fireEvent.click(await screen.findByRole("menuitem", { name: "Nouvelle frise" }));

  await waitFor(() =>
    expect(router.state.location.pathname).toBe("/world/demo/world/timeline/tl2"),
  );
  expect(calls).toContainEqual({
    command: "create_timeline",
    payload: { title: "Nouvelle frise", trackName: "Événements" },
  });
  expect(await screen.findByText("Cette frise est encore vide.")).toBeTruthy();
  expect(await screen.findByRole("list", { name: "Événements" })).toBeTruthy();
});

test("tracks hold their items, named in the world's calendar, with the eras behind", async () => {
  await renderAt("/world/demo/world/timeline/tl1");

  const view = await screen.findByRole("application", { name: "Frise Histoire de Westeros" });
  const wars = within(view).getByRole("list", { name: "Guerres" });
  expect(
    within(wars).getByRole("button", { name: "Rébellion de Robert, de 282 AC à 283 AC" }),
  ).toBeTruthy();
  expect(
    within(wars).getByRole("button", { name: "Conquête d'Aegon, de 2 av. AC à 0 AC" }),
  ).toBeTruthy();
  // An item standing for a card takes its name.
  const kings = within(view).getByRole("list", { name: "Rois" });
  expect(
    within(kings).getByRole("button", { name: "Robert Baratheon, 3e mois 283 AC" }),
  ).toBeTruthy();
  // The eras name their bands.
  expect(within(view).getByText("Après la Conquête")).toBeTruthy();
  expect(within(view).getByText("Avant la Conquête")).toBeTruthy();
});

test("an item opens its details, and its card from there", async () => {
  const router = await renderAt("/world/demo/world/timeline/tl1");

  fireEvent.click(await screen.findByRole("button", { name: /^Robert Baratheon, / }));
  const details = await screen.findByRole("region", { name: /^Robert Baratheon, / });
  expect(within(details).getByText("3e mois 283 AC · Rois")).toBeTruthy();

  fireEvent.click(within(details).getByRole("link", { name: "Ouvrir Robert Baratheon" }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/world/demo/world/card/robert"));
});

test("the keys zoom and frame the timeline again", async () => {
  await renderAt("/world/demo/world/timeline/tl1");
  const view = await screen.findByRole("application", { name: "Frise Histoire de Westeros" });
  const conquest = within(view).getByRole("button", { name: /^Conquête d'Aegon/ });
  const rebellion = within(view).getByRole("button", { name: /^Rébellion de Robert/ });
  // The distance between two items grows as one zooms in.
  const width = () =>
    Number.parseFloat(rebellion.style.left) - Number.parseFloat(conquest.style.left);
  const framed = width();

  act(() => view.focus());
  fireEvent.keyDown(view, { key: "+" });
  expect(width()).toBeGreaterThan(framed);
  fireEvent.keyDown(view, { key: "-" });
  fireEvent.keyDown(view, { key: "-" });
  expect(width()).toBeLessThan(framed);
  fireEvent.keyDown(view, { key: "0" });
  expect(width()).toBeCloseTo(framed);

  fireEvent.click(screen.getByRole("button", { name: "Zoomer" }));
  expect(width()).toBeGreaterThan(framed);
  fireEvent.click(screen.getByRole("button", { name: "Tout voir" }));
  expect(width()).toBeCloseTo(framed);
});
