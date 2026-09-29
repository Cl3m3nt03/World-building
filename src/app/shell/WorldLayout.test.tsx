// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { clearMocks, mockConvertFileSrc, mockIPC } from "@tauri-apps/api/mocks";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createAppRouter } from "@/app/router";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { AppSettings, Card, WorldInfo } from "@/lib/bindings";
import { createQueryClient } from "@/lib/query";

const WORLD: WorldInfo = {
  id: "demo",
  name: "Eldefleur",
  genre: "fantasy",
  description: "",
  mainImage: null,
  theme: { kind: "default" },
  preferences: { entityDetection: true, autoMentionLinks: true, animateNewLinks: true },
  path: "C:\\Mondes\\Eldefleur",
  schemaVersion: 6,
  createdAt: "2026-09-29T10:00:00Z",
  lastOpenedAt: "2026-09-29T10:00:00Z",
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

const CARD: Card = {
  id: "aragorn",
  title: "Aragorn",
  typeId: null,
  imageAssetId: null,
  aliases: [],
  createdAt: "2026-09-29T10:00:00Z",
  updatedAt: "2026-09-29T10:00:00Z",
  trashedAt: null,
};

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mockConvertFileSrc("windows");
  mockIPC((command) => {
    switch (command) {
      case "current_world":
        return WORLD;
      case "get_settings":
        return SETTINGS;
      case "get_card":
        return CARD;
      case "get_card_content":
        return "[]";
      case "list_cards":
        return [CARD];
      case "list_assets":
      case "list_card_types":
      case "recent_documents":
      case "count_cards_by_type":
      case "card_properties":
      case "card_backlinks":
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

test("from the media library, the Home tab leads back to Home", async () => {
  const router = await renderAt("/world/demo/media");
  await screen.findByRole("heading", { name: "Médiathèque" });

  fireEvent.click(screen.getByRole("tab", { name: "Home" }));

  await waitFor(() => expect(router.state.location.pathname).toBe("/world/demo/home"));
});

test("the World tab clicked while a card is open keeps the card", async () => {
  const router = await renderAt("/world/demo/world/card/aragorn");
  await screen.findByLabelText("Nom de la carte");

  fireEvent.click(screen.getByRole("tab", { name: "World" }));

  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(router.state.location.pathname).toBe("/world/demo/world/card/aragorn");
});
