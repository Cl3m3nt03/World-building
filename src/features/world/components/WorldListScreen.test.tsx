// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { clearMocks, mockConvertFileSrc, mockIPC } from "@tauri-apps/api/mocks";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test } from "vitest";
import { createAppRouter } from "@/app/router";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { AppSettings, RecentWorld } from "@/lib/bindings";
import { createQueryClient } from "@/lib/query";
import { relativeTime } from "../relativeTime";

const world = (name: string, hoursAgo: number): RecentWorld => ({
  path: `C:/Worlds/${name}`,
  name,
  id: `id-${name}`,
  genre: "fantasy",
  thumbnail: false,
  lastOpenedAt: new Date(Date.now() - hoursAgo * 3600_000).toISOString(),
});

let recentWorlds: RecentWorld[];

beforeEach(() => {
  mockConvertFileSrc("windows");
  recentWorlds = [];
  mockIPC((command) => {
    switch (command) {
      case "get_settings":
        return {
          preferences: {
            language: "fr",
            theme: "system",
            transparencyEffects: true,
            radioVolume: 70,
            radioMode: "loop",
          },
          recentWorlds,
          defaultWorldsDir: null,
        } satisfies AppSettings;
      case "missing_recent_worlds":
        return [];
      case "current_world":
        return null;
      default:
        return undefined;
    }
  });
});

afterEach(() => {
  cleanup();
  clearMocks();
});

async function renderList() {
  const queryClient = createQueryClient();
  const router = createAppRouter(queryClient, createMemoryHistory({ initialEntries: ["/"] }));
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
}

test("welcomes the first launch with the two ways in", async () => {
  await renderList();
  const welcome = (await screen.findByRole("heading", { name: "Votre premier monde vous attend" }))
    .parentElement as HTMLElement;
  expect(within(welcome).getByRole("button", { name: "Créer un monde" })).toBeDefined();
  expect(within(welcome).getByRole("button", { name: "Ouvrir un monde" })).toBeDefined();
});

test("puts the last opened world forward and the others in the grid", async () => {
  recentWorlds = [world("Eldefleur", 2), world("Ombreval", 30), world("Saphir", 200)];
  await renderList();
  const featured = await screen.findByRole("button", { name: "Ouvrir Eldefleur" });
  expect(featured.textContent).toContain("Reprendre");
  expect(featured.textContent).toContain("il y a 2 heures");
  expect(screen.getByRole("heading", { name: "Autres mondes" })).toBeDefined();
  const grid = screen.getByRole("list");
  expect(within(grid).queryByRole("button", { name: "Ouvrir Eldefleur" })).toBeNull();
  expect(within(grid).getByRole("button", { name: "Ouvrir Ombreval" }).textContent).toContain(
    "hier",
  );
  // No search for a short list.
  expect(screen.queryByRole("searchbox")).toBeNull();
});

test("moves between the folios with the arrows", async () => {
  recentWorlds = [world("Eldefleur", 1), world("Ombreval", 2), world("Saphir", 3)];
  await renderList();
  const first = await screen.findByRole("button", { name: "Ouvrir Ombreval" });
  first.focus();
  fireEvent.keyDown(first, { key: "ArrowRight" });
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Ouvrir Saphir" }));
  fireEvent.keyDown(document.activeElement as HTMLElement, { key: "Home" });
  expect(document.activeElement).toBe(first);
});

test("searches a long list, which then shows every world", async () => {
  recentWorlds = ["Ardent", "Brume", "Cendre", "Dune", "Écume", "Faille", "Givre"].map((name, i) =>
    world(name, i + 1),
  );
  await renderList();
  const search = await screen.findByRole("searchbox", { name: "Rechercher un monde" });
  fireEvent.change(search, { target: { value: "ume" } });
  const grid = screen.getByRole("list");
  expect(
    within(grid)
      .getAllByRole("button", { name: /^Ouvrir/ })
      .map((b) => b.ariaLabel),
  ).toEqual(["Ouvrir Brume", "Ouvrir Écume"]);
  fireEvent.change(search, { target: { value: "zzz" } });
  expect(screen.getByText("Aucun monde ne contient « zzz ».")).toBeDefined();
});

test("says when a world was opened the way people say it", () => {
  const now = new Date("2026-10-25T12:00:00Z");
  expect(relativeTime("2026-10-25T11:59:40Z", "fr", now)).toBe("maintenant");
  expect(relativeTime("2026-10-25T09:00:00Z", "fr", now)).toBe("il y a 3 heures");
  expect(relativeTime("2026-10-24T12:00:00Z", "fr", now)).toBe("hier");
  expect(relativeTime("2026-10-24T12:00:00Z", "en", now)).toBe("yesterday");
  expect(relativeTime("not a date", "fr", now)).toBe("");
});
