// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { clearMocks, mockConvertFileSrc, mockIPC } from "@tauri-apps/api/mocks";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createAppRouter } from "@/app/router";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { AppSettings, Card, Timeline, WikiPage, WorldInfo } from "@/lib/bindings";
import { createQueryClient } from "@/lib/query";

const WORLD: WorldInfo = {
  id: "demo",
  name: "Eldefleur",
  path: "C:/Worlds/Eldefleur",
  genre: "fantasy",
  description: "",
  mainImage: null,
  theme: { kind: "default" },
  preferences: { entityDetection: false, autoMentionLinks: false, animateNewLinks: false },
  calendar: { eras: [], months: Array.from({ length: 12 }, () => ({ name: "", days: 30 })) },
  storageLimit: null,
  schemaVersion: 6,
  createdAt: "2026-09-27T10:00:00Z",
  lastOpenedAt: "2026-09-27T10:00:00Z",
};

const SETTINGS: AppSettings = {
  preferences: {
    language: "fr",
    theme: "system",
    transparencyEffects: true,
    radioVolume: 70,
    radioMode: "loop",
    worldRail: false,
  },
  recentWorlds: [],
  defaultWorldsDir: null,
};

function card(id: string, title: string): Card {
  return {
    id,
    title,
    typeId: null,
    imageAssetId: null,
    aliases: [],
    createdAt: "2026-09-27T10:00:00Z",
    updatedAt: "2026-09-27T10:00:00Z",
    trashedAt: null,
  };
}

const CARDS = [card("gondor", "Gondor"), card("minas", "Minas Tirith"), card("rohan", "Rohan")];

/** Gondor (a page) and Minas Tirith (not one) on the timeline, and a hidden item. */
const AGES: Timeline = {
  links: [],
  id: "ages",
  title: "Les Âges",
  tracks: [{ id: "t", name: "Histoire", color: "amber" }],
  items: [
    {
      id: "founding",
      trackId: "t",
      cardId: "gondor",
      title: "",
      color: "blue",
      description: "Fondation du royaume.",
      start: 10 * 360,
      end: null,
      precision: "year",
      tags: ["Royaumes"],
    },
    {
      id: "siege",
      trackId: "t",
      cardId: "minas",
      title: "",
      color: "red",
      description: "",
      start: 30 * 360,
      end: 31 * 360,
      precision: "year",
    },
    {
      id: "secret",
      trackId: "t",
      cardId: null,
      title: "Le secret",
      color: "slate",
      description: "",
      start: 20 * 360,
      end: null,
      precision: "year",
      hidden: true,
    },
  ],
};

function page(id: string, title: string, kind: WikiPage["kind"] = "card"): WikiPage {
  return { id, kind, title, typeId: null, imageAssetId: null, aliases: [] };
}

let pages: WikiPage[];

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mockConvertFileSrc("windows");
  // jsdom lays nothing out: the timeline's drawing is 900 pixels wide.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private callback: ResizeObserverCallback) {}
      observe(target: Element) {
        if (target.getAttribute("role") !== "application") return;
        this.callback(
          [{ target, contentRect: { width: 900, height: 400 } } as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        );
      }
      unobserve() {}
      disconnect() {}
    },
  );
  pages = [page("ages", "Les Âges", "timeline"), page("gondor", "Gondor")];
  mockIPC((command, payload) => {
    const args = payload as Record<string, unknown>;
    switch (command) {
      case "current_world":
        return WORLD;
      case "get_settings":
        return SETTINGS;
      case "list_card_types":
        return [];
      case "list_cards":
        return args.trashed ? [] : CARDS;
      case "get_timeline":
        return AGES;
      case "get_card":
        return CARDS.find((c) => c.id === args.id);
      case "get_card_content":
        return "[]";
      case "card_properties":
      case "card_backlinks":
        return [];
      case "wiki_pages":
        return pages;
      case "wiki_settings":
        return { title: "", description: "", bannerAssetId: null, featured: [], theme: {} };
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

test("a timeline's page: read only, its chronicle, hidden items left out, pages linked", async () => {
  const router = await renderAt("/world/demo/wiki/timeline/ages");
  const article = await screen.findByRole("article", { name: "Les Âges" });
  expect(within(article).getByRole("heading", { level: 1, name: "Les Âges" })).toBeTruthy();
  const view = within(article).getByRole("application", { name: "Frise Les Âges" });
  expect(within(view).getByRole("button", { name: /^Gondor, / })).toBeTruthy();
  expect(within(view).queryByRole("button", { name: /^Le secret/ })).toBeNull();

  const chronicle = within(article).getByRole("region", { name: "Chronologie" });
  expect(within(chronicle).getByText("Fondation du royaume.")).toBeTruthy();
  expect(within(chronicle).getByText("30 – 31")).toBeTruthy();
  expect(within(chronicle).queryByText("Le secret")).toBeNull();
  // Minas Tirith has no page: its name only.
  expect(within(chronicle).queryByRole("link", { name: "Minas Tirith" })).toBeNull();
  fireEvent.click(within(chronicle).getByRole("link", { name: "Gondor" }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/world/demo/wiki/card/gondor"));
});

test("a timeline that is not in the wiki says so", async () => {
  pages = [page("gondor", "Gondor")];
  await renderAt("/world/demo/wiki/timeline/ages");
  expect(await screen.findByText("Cette frise n'est pas visible dans le wiki.")).toBeTruthy();
});
