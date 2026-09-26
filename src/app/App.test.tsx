// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ErrorBoundary } from "@/app/ErrorScreen";
import { createAppRouter } from "@/app/router";
import { tabFromPath } from "@/app/shell/WorldLayout";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { AppSettings, WorldInfo } from "@/lib/bindings";
import { createQueryClient } from "@/lib/query";

const WORLD: WorldInfo = {
  id: "demo",
  name: "Eldefleur",
  path: "C:/Worlds/Eldefleur",
  genre: "fantasy",
  description: "",
  mainImage: null,
  schemaVersion: 1,
  createdAt: "2026-09-26T10:00:00Z",
  lastOpenedAt: "2026-09-26T10:00:00Z",
};

const SETTINGS: AppSettings = {
  preferences: { language: "fr", theme: "system", transparencyEffects: true },
  recentWorlds: [],
  defaultWorldsDir: null,
};

let openWorld: WorldInfo | null;

beforeEach(() => {
  openWorld = WORLD;
  mockIPC((command) => {
    switch (command) {
      case "current_world":
        return openWorld;
      case "close_world":
        openWorld = null;
        return null;
      case "get_settings":
        return SETTINGS;
      default:
        return undefined;
    }
  });
});

afterEach(() => {
  cleanup();
  clearMocks();
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

describe("routing", () => {
  test("/ shows the world list", async () => {
    await renderAt("/");
    expect(screen.getByRole("heading", { name: "Mondes" })).toBeTruthy();
  });

  test("/world/$worldId redirects to the Home tab of the open world", async () => {
    const router = await renderAt("/world/demo");
    expect(router.state.location.pathname).toBe("/world/demo/home");
    expect(screen.getByRole("heading", { name: "Bienvenue dans Eldefleur" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Monde courant/ }).textContent).toContain(
      "Eldefleur",
    );
  });

  test("a world that is not the open one sends back to the world list", async () => {
    const router = await renderAt("/world/other/home");
    expect(router.state.location.pathname).toBe("/");
  });

  test("without an open world, world routes send back to the world list", async () => {
    openWorld = null;
    const router = await renderAt("/world/demo/world");
    expect(router.state.location.pathname).toBe("/");
  });

  test("clicking a tab navigates to its route", async () => {
    const router = await renderAt("/world/demo/home");
    await act(async () => {
      fireEvent.mouseDown(screen.getByRole("tab", { name: "Wiki" }), { button: 0 });
    });
    expect(router.state.location.pathname).toBe("/world/demo/wiki");
    expect(screen.getByRole("tab", { name: "Wiki" }).getAttribute("data-state")).toBe("active");
  });

  test("the Worlds button closes the world and goes back to the world list", async () => {
    const router = await renderAt("/world/demo/world");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Mondes" }));
    });
    await act(async () => {
      await router.load();
    });
    expect(openWorld).toBeNull();
    expect(router.state.location.pathname).toBe("/");
  });

  test("creation tiles say they are not available yet instead of doing nothing", async () => {
    const router = await renderAt("/world/demo/world");
    const card = screen.getByRole("button", { name: "Carte" });
    expect(card.getAttribute("aria-disabled")).toBe("true");
    expect(card.getAttribute("aria-describedby")).toBeTruthy();
    expect(document.getElementById(card.getAttribute("aria-describedby") ?? "")?.textContent).toBe(
      "Bientôt disponible : arrive avec M2",
    );
    fireEvent.click(card);
    expect(router.state.location.pathname).toBe("/world/demo/world");
  });

  test("the Wiki and Quill tabs explain what is coming", async () => {
    await renderAt("/world/demo/wiki");
    expect(screen.getByText(/Le wiki présentera votre monde/)).toBeTruthy();
    expect(screen.getByText("Bientôt disponible : arrive avec M8")).toBeTruthy();
  });

  test("an unknown route shows the not-found screen", async () => {
    await renderAt("/nowhere");
    expect(screen.getByRole("heading", { name: "Page introuvable" })).toBeTruthy();
  });

  test("tabFromPath reads the tab segment", () => {
    expect(tabFromPath("/world/demo/quill")).toBe("quill");
    expect(tabFromPath("/world/demo")).toBeUndefined();
    expect(tabFromPath("/world/demo/nope")).toBeUndefined();
  });
});

describe("error boundary", () => {
  test("a render error shows the error screen instead of a blank page", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    function Broken(): never {
      throw new Error("boom");
    }

    render(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Une erreur est survenue" })).toBeTruthy();
    expect(screen.getByText(/boom/)).toBeTruthy();
    consoleError.mockRestore();
  });
});
