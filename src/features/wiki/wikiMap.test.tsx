// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { clearMocks, mockConvertFileSrc, mockIPC } from "@tauri-apps/api/mocks";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createAppRouter } from "@/app/router";
import { TooltipProvider } from "@/components/ui/tooltip";
import type {
  AppSettings,
  Card,
  MapPin,
  WikiPage,
  WorldInfo,
  Map as WorldMap,
} from "@/lib/bindings";
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

function pin(id: string, cardId: string, layerId = "l1"): MapPin {
  return { id, layerId, cardId, x: 0.4, y: 0.4, icon: "", color: "", label: "", size: null };
}

/** Arda: Gondor (a page), Minas Tirith (not one), Rohan (a page, on a hidden layer). */
const ARDA: WorldMap = {
  id: "arda",
  title: "Arda",
  backgroundAssetId: `${"a".repeat(64)}.png`,
  width: 2000,
  height: 1500,
  tiled: false,
  content: {
    layers: [
      { id: "l1", name: "Calque 1", visible: true },
      { id: "l2", name: "Caché", visible: false },
    ],
    pins: [pin("p1", "gondor"), pin("p2", "minas"), pin("p3", "rohan", "l2")],
    zones: [],
    texts: [],
  },
};

function page(id: string, title: string, kind: WikiPage["kind"] = "card"): WikiPage {
  return { id, kind, title, typeId: null, imageAssetId: null, aliases: [] };
}

let pages: WikiPage[];

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mockConvertFileSrc("windows");
  pages = [page("arda", "Arda", "map"), page("gondor", "Gondor"), page("rohan", "Rohan")];
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
      case "get_map":
        return ARDA;
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

test("the map lists its pages on visible layers, and a pin of a page opens it", async () => {
  const router = await renderAt("/world/demo/wiki/map/arda");
  const article = await screen.findByRole("article", { name: "Arda" });
  expect(within(article).getByRole("heading", { level: 1, name: "Arda" })).toBeTruthy();
  const list = await screen.findByRole("region", { name: "Sur cette map" });
  expect(
    within(list)
      .getAllByRole("link")
      .map((link) => link.textContent),
  ).toEqual(["Gondor"]);

  // A pin of a card without a page does nothing; of a page, opens it.
  const marker = (name: string) =>
    article.querySelector<HTMLElement>(`.bz-map-pin[aria-label="${name}"]`);
  await waitFor(() => expect(marker("Minas Tirith")).toBeTruthy());
  fireEvent.click(marker("Minas Tirith") as HTMLElement);
  expect(router.state.location.pathname).toBe("/world/demo/wiki/map/arda");
  fireEvent.click(marker("Gondor") as HTMLElement);
  await waitFor(() => expect(router.state.location.pathname).toBe("/world/demo/wiki/card/gondor"));
});

test("a map without a page says so", async () => {
  pages = [];
  await renderAt("/world/demo/wiki/map/arda");
  expect(await screen.findByText("Cette map n'est pas visible dans le wiki.")).toBeTruthy();
});
