// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { clearMocks, mockConvertFileSrc, mockIPC } from "@tauri-apps/api/mocks";
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
  theme: { kind: "default" },
  preferences: { entityDetection: true, autoMentionLinks: true, animateNewLinks: true },
  schemaVersion: 1,
  createdAt: "2026-09-20T10:00:00Z",
  lastOpenedAt: "2026-09-25T18:30:00Z",
};

const SETTINGS: AppSettings = {
  preferences: {
    language: "fr",
    theme: "system",
    transparencyEffects: true,
    radioVolume: 70,
    radioMode: "loop",
  },
  recentWorlds: [
    {
      path: ELDEFLEUR.path,
      name: ELDEFLEUR.name,
      id: "5f0c4ba6-1f55-4c0e-9d6c-3f1a2a8e6c11",
      genre: "scienceFiction",
      thumbnail: true,
      lastOpenedAt: ELDEFLEUR.lastOpenedAt,
    },
  ],
  defaultWorldsDir: null,
};

type Call = { command: string; payload: unknown };
let calls: Call[];
let openWorld: WorldInfo | null;
let missingPaths: string[];

beforeEach(() => {
  mockConvertFileSrc("windows");
  calls = [];
  openWorld = null;
  missingPaths = [];
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
      case "missing_recent_worlds":
        return missingPaths;
      case "remove_recent_world":
        return { ...SETTINGS, recentWorlds: [] };
      case "relocate_recent_world":
        missingPaths = [];
        return {
          ...SETTINGS,
          recentWorlds: SETTINGS.recentWorlds.map((recent) => ({
            ...recent,
            path: (payload as { newPath: string }).newPath,
          })),
        };
      case "plugin:dialog|open":
        return "E:/Mondes/Eldefleur";
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
  expect(recent.textContent).toContain("Science-fiction");
  expect(recent.querySelector("img")?.getAttribute("src")).toMatch(
    /^http:\/\/bzthumb\.localhost\/5f0c4ba6-1f55-4c0e-9d6c-3f1a2a8e6c11\?v=/,
  );

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
    genre: "fantasy",
  });
});

test("creates a world of the chosen genre", async () => {
  const router = await renderStartScreen();

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Créer un monde" }));
  });
  await waitFor(() =>
    expect((screen.getByLabelText("Emplacement") as HTMLInputElement).value).not.toBe(""),
  );
  fireEvent.change(screen.getByLabelText("Nom"), { target: { value: "Nébuleuse" } });

  const genre = screen.getByRole("combobox", { name: "Genre" });
  expect(genre.textContent).toContain("Fantasy");
  await act(async () => {
    fireEvent.pointerDown(genre, { button: 0, pointerType: "mouse" });
  });
  await act(async () => {
    fireEvent.click(await screen.findByRole("option", { name: "Science-fiction" }));
  });
  expect(genre.textContent).toContain("Science-fiction");

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Créer" }));
  });

  await waitFor(() => expect(router.state.location.pathname).toBe("/world/w-new/home"));
  expect(calls.find((call) => call.command === "create_world")?.payload).toMatchObject({
    name: "Nébuleuse",
    genre: "scienceFiction",
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

test("a world whose folder moved is flagged and can be relocated", async () => {
  missingPaths = [ELDEFLEUR.path];
  await renderStartScreen();

  const card = await screen.findByRole("button", { name: "Relocaliser Eldefleur" });
  expect(card.textContent).toContain("Introuvable");

  await act(async () => {
    fireEvent.click(card);
  });

  await waitFor(() =>
    expect(calls.find((call) => call.command === "relocate_recent_world")?.payload).toEqual({
      oldPath: ELDEFLEUR.path,
      newPath: "E:/Mondes/Eldefleur",
    }),
  );
  expect(await screen.findByRole("button", { name: "Ouvrir Eldefleur" })).toBeTruthy();
});

test("relocating onto another world's folder explains it and keeps the list", async () => {
  missingPaths = [ELDEFLEUR.path];
  mockIPC((command) => {
    if (command === "get_settings") return SETTINGS;
    if (command === "missing_recent_worlds") return missingPaths;
    if (command === "plugin:dialog|open") return "E:/Mondes/Autre";
    if (command === "relocate_recent_world") {
      throw { code: "wrong_world", message: "E:/Mondes/Autre" };
    }
    return null;
  });
  await renderStartScreen();

  await act(async () => {
    fireEvent.click(await screen.findByRole("button", { name: "Relocaliser Eldefleur" }));
  });

  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Ce dossier contient un autre monde");
  expect(alert.textContent).toContain("E:/Mondes/Autre");
  expect(screen.getByRole("button", { name: "Relocaliser Eldefleur" })).toBeTruthy();
});

test("removing a world from the list asks for confirmation first", async () => {
  await renderStartScreen();

  await act(async () => {
    fireEvent.pointerDown(await screen.findByRole("button", { name: "Actions pour Eldefleur" }), {
      button: 0,
      pointerType: "mouse",
    });
  });
  await act(async () => {
    fireEvent.click(await screen.findByRole("menuitem", { name: "Retirer de la liste" }));
  });

  const dialog = await screen.findByRole("dialog");
  expect(dialog.textContent).toContain("son dossier et tout son contenu restent sur le disque");
  expect(calls.some((call) => call.command === "remove_recent_world")).toBe(false);

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Retirer de la liste" }));
  });

  expect(calls.find((call) => call.command === "remove_recent_world")?.payload).toEqual({
    path: ELDEFLEUR.path,
  });
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Ouvrir Eldefleur" })).toBeNull(),
  );
});
