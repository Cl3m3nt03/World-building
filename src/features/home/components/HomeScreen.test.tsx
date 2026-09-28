// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { clearMocks, mockConvertFileSrc, mockIPC } from "@tauri-apps/api/mocks";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createAppRouter } from "@/app/router";
import { useUiStore } from "@/app/stores/ui";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { AppSettings, CardType, RecentDocument, TypeCount, WorldInfo } from "@/lib/bindings";
import { createQueryClient } from "@/lib/query";

const WORLD: WorldInfo = {
  id: "demo",
  name: "Eldefleur",
  genre: "scienceFiction",
  description: "",
  mainImage: null,
  theme: { kind: "default" },
  preferences: { entityDetection: true, autoMentionLinks: true, animateNewLinks: true },
  path: "C:\\Mondes\\Eldefleur",
  schemaVersion: 5,
  createdAt: "2026-09-26T10:00:00Z",
  lastOpenedAt: "2026-09-26T10:00:00Z",
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

function cardType(id: string, name: string, parentId: string | null = null): CardType {
  return {
    id,
    parentId,
    name,
    icon: "user",
    color: "blue",
    guidedTemplate: [],
    orientation: "portrait",
    canvasFormat: "standard",
    sortOrder: 0,
  };
}

const TYPES = [
  cardType("character", "Personnage"),
  cardType("place", "Lieu"),
  cardType("station", "Station", "place"),
  cardType("ship", "Vaisseau"),
];

let world: WorldInfo;
let recent: RecentDocument[];
let counts: TypeCount[];

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mockConvertFileSrc("windows");
  useUiStore.setState({ worldSettings: null, cardTypesOpen: false });
  world = WORLD;
  recent = [];
  counts = [];
  mockIPC((command) => {
    switch (command) {
      case "current_world":
        return world;
      case "get_settings":
        return SETTINGS;
      case "list_assets":
        return [{ id: "a.png" }, { id: "b.mp3" }, { id: "c.png" }];
      case "list_card_types":
        return TYPES;
      case "recent_documents":
        return recent;
      case "count_cards_by_type":
        return counts;
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

async function renderHome() {
  const queryClient = createQueryClient();
  const router = createAppRouter(
    queryClient,
    createMemoryHistory({ initialEntries: [`/world/${world.id}/home`] }),
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
  return router;
}

function recentCard(id: string, title: string, typeId: string, minutesAgo: number): RecentDocument {
  return {
    id,
    kind: "card",
    title,
    openedAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
    imageAssetId: null,
    typeId,
  };
}

test("welcomes to the open world and sums it up", async () => {
  counts = [
    { typeId: "character", count: 2 },
    { typeId: "station", count: 1 },
    { typeId: "place", count: 1 },
  ];
  await renderHome();

  expect(await screen.findByRole("heading", { name: "Bienvenue dans Eldefleur" })).toBeTruthy();
  expect(screen.getByText("Science-fiction")).toBeTruthy();
  expect(await screen.findByText("3 fichiers")).toBeTruthy();
  expect(await screen.findByText("4 cartes")).toBeTruthy();
  // Subtypes count for their type; types without cards are left out.
  const byType = screen.getByRole("list", { name: "Cartes par type" });
  expect(Array.from(byType.querySelectorAll("li")).map((li) => li.textContent)).toEqual([
    "Personnage2",
    "Lieu2",
  ]);
  expect(screen.getByText(/Il arrive avec M5/)).toBeTruthy();
});

test("with no card opened yet, invites to create the first one", async () => {
  await renderHome();

  expect(await screen.findByText("Commencez par créer votre première carte :")).toBeTruthy();
  expect(screen.getByText("Les cartes que vous ouvrez apparaîtront ici.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Nouvelle carte" })).toBeTruthy();
});

test("offers to resume the last card and lists the recent ones", async () => {
  recent = [
    recentCard("aria", "Aria", "character", 38),
    recentCard("orbit", "Station Orbitale", "station", 60 * 26),
    recentCard("nova", "Nova", "ship", 3),
  ];
  const router = await renderHome();

  const resume = await screen.findByRole("link", { name: "Reprendre Aria" });
  const list = screen.getByRole("list", { name: "Documents récents" });
  const items = Array.from(list.querySelectorAll("li")).map((li) => li.textContent);
  expect(items[0]).toMatch(/^Aria.*38\smin/);
  expect(items[1]).toMatch(/^Station Orbitale.*hier/);

  fireEvent.click(resume);
  await waitFor(() => expect(router.state.location.pathname).toBe("/world/demo/world/card/aria"));
});

test("the media library entry leads to the media library", async () => {
  const router = await renderHome();

  fireEvent.click(await screen.findByRole("link", { name: "Médiathèque" }));

  await vi.waitFor(() => expect(router.state.location.pathname).toBe("/world/demo/media"));
});

test("world settings and the description prompt open the world settings", async () => {
  await renderHome();

  fireEvent.click(await screen.findByRole("button", { name: "Réglages du monde" }));
  expect(useUiStore.getState().worldSettings).toBe("general");
  expect(await screen.findByRole("dialog", { name: "Réglages du monde" })).toBeTruthy();

  // Close the real screen before the next click.
  act(() => useUiStore.setState({ worldSettings: null }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  fireEvent.click(screen.getByRole("button", { name: "Ajouter une description…" }));
  expect(useUiStore.getState().worldSettings).toBe("general");
});

test("types opens the card types screen; theme opens the theme settings", async () => {
  world = { ...WORLD, description: "Un monde de canaux." };
  await renderHome();

  fireEvent.click(await screen.findByRole("button", { name: "Thème" }));
  expect(useUiStore.getState().worldSettings).toBe("theme");
  act(() => useUiStore.setState({ worldSettings: null }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

  expect(screen.getByText("Un monde de canaux.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Types" }));
  expect(useUiStore.getState().cardTypesOpen).toBe(true);
  expect(await screen.findByRole("dialog", { name: "Types de cartes" })).toBeTruthy();
});
