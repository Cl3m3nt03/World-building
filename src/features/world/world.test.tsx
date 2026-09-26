// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test } from "vitest";
import { createAppRouter } from "@/app/router";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { AppSettings, WorldInfo } from "@/lib/bindings";
import { createQueryClient } from "@/lib/query";

const ELDEFLEUR: WorldInfo = {
  id: "w-1",
  name: "Eldefleur",
  path: "C:/Worlds/Eldefleur",
  genre: "fantasy",
  description: "",
  mainImage: null,
  schemaVersion: 1,
  createdAt: "2026-09-20T10:00:00Z",
  lastOpenedAt: "2026-09-25T18:30:00Z",
};

const SETTINGS: AppSettings = {
  preferences: { language: "fr", theme: "system", transparencyEffects: true },
  recentWorlds: [
    { path: ELDEFLEUR.path, name: ELDEFLEUR.name, lastOpenedAt: ELDEFLEUR.lastOpenedAt },
  ],
};

type Call = { command: string; payload: unknown };
let calls: Call[];
let openWorld: WorldInfo | null;

beforeEach(() => {
  calls = [];
  openWorld = null;
  mockIPC((command, payload) => {
    calls.push({ command, payload });
    switch (command) {
      case "get_settings":
        return SETTINGS;
      case "current_world":
        return openWorld;
      case "open_world":
        openWorld = ELDEFLEUR;
        return ELDEFLEUR;
      case "create_world": {
        const { name } = payload as { name: string };
        openWorld = { ...ELDEFLEUR, id: "w-new", name };
        return openWorld;
      }
      case "default_worlds_dir":
        return "C:/Users/me/Documents/BuilderZ";
      default:
        return undefined;
    }
  });
});

afterEach(() => {
  cleanup();
  clearMocks();
});

async function renderStartScreen() {
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
  return router;
}

test("lists the recent worlds and reopens one on click", async () => {
  const router = await renderStartScreen();

  const recent = await screen.findByRole("button", { name: "Ouvrir Eldefleur" });
  expect(recent.textContent).toContain(ELDEFLEUR.path);

  await act(async () => {
    fireEvent.click(recent);
  });

  await waitFor(() => expect(router.state.location.pathname).toBe("/world/w-1/home"));
  expect(calls.find((call) => call.command === "open_world")?.payload).toMatchObject({
    path: ELDEFLEUR.path,
  });
});

test("creates a world in the default location and opens it", async () => {
  const router = await renderStartScreen();

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Créer un monde" }));
  });
  const location = await screen.findByLabelText("Emplacement");
  await waitFor(() =>
    expect((location as HTMLInputElement).value).toBe("C:/Users/me/Documents/BuilderZ"),
  );

  fireEvent.change(screen.getByLabelText("Nom"), { target: { value: "Terres du Nord" } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Créer" }));
  });

  await waitFor(() => expect(router.state.location.pathname).toBe("/world/w-new/home"));
  expect(calls.find((call) => call.command === "create_world")?.payload).toMatchObject({
    parentDir: "C:/Users/me/Documents/BuilderZ",
    name: "Terres du Nord",
  });
});

test("shows a translated error when a world cannot be opened", async () => {
  mockIPC((command) => {
    if (command === "get_settings") return SETTINGS;
    if (command === "open_world") {
      throw { code: "world_invalid", message: "world.json is missing" };
    }
    return null;
  });
  await renderStartScreen();

  await act(async () => {
    fireEvent.click(await screen.findByRole("button", { name: "Ouvrir Eldefleur" }));
  });

  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("n'est pas un monde BuilderZ valide");
});
