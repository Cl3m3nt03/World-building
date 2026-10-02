// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { clearMocks, mockConvertFileSrc, mockIPC } from "@tauri-apps/api/mocks";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createAppRouter } from "@/app/router";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Asset, DocumentTree, WorldInfo, Map as WorldMap } from "@/lib/bindings";
import { documentRoute } from "@/lib/documentRoute";
import { createQueryClient } from "@/lib/query";

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
  schemaVersion: 10,
  createdAt: "2026-10-02T10:00:00Z",
  lastOpenedAt: "2026-10-02T10:00:00Z",
} satisfies WorldInfo;

const OTHER: Asset = {
  id: `${"b".repeat(64)}.png`,
  name: "Arda remaniée.png",
  kind: "image",
  mime: "image/png",
  size: 4096,
  width: 4000,
  height: 3000,
  createdAt: "2026-10-02T10:00:00Z",
};

const IMAGE: Asset = {
  id: `${"a".repeat(64)}.png`,
  name: "Terre du Milieu.png",
  kind: "image",
  mime: "image/png",
  size: 4096,
  width: 2000,
  height: 1500,
  createdAt: "2026-10-02T10:00:00Z",
};

function map(title: string): WorldMap {
  return {
    id: "m1",
    title,
    backgroundAssetId: IMAGE.id,
    width: 2000,
    height: 1500,
    content: {
      layers: [{ id: "l1", name: "Calque 1", visible: true }],
      pins: [],
      zones: [],
      texts: [],
    },
  };
}

const GONDOR = {
  id: "gondor",
  title: "Gondor",
  typeId: null,
  imageAssetId: null,
  aliases: [],
  createdAt: "2026-10-02T10:00:00Z",
  updatedAt: "2026-10-02T10:00:00Z",
  trashedAt: null,
};

let calls: { command: string; payload: unknown }[];
let tree: DocumentTree;
let stored: WorldMap | null;
let slowReload: boolean;

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mockConvertFileSrc("windows");
  calls = [];
  stored = null;
  slowReload = false;
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
      case "list_assets":
        return [IMAGE, OTHER];
      case "list_cards":
        return [GONDOR];
      case "create_map": {
        const { title } = payload as { title: string };
        stored = map(title);
        return stored;
      }
      case "get_map":
        // A slow disk: the map comes back a moment later.
        return slowReload
          ? new Promise((resolve) => setTimeout(() => resolve(stored), 200))
          : stored;
      case "set_map_background": {
        const { assetId } = payload as { assetId: string };
        if (stored) stored = { ...stored, backgroundAssetId: assetId, width: 4000, height: 3000 };
        return stored;
      }
      case "save_map": {
        const { content } = payload as { content: WorldMap["content"] };
        if (stored) stored = { ...stored, content };
        return null;
      }
      case "rename_document": {
        const { title } = payload as { title: string };
        if (stored) stored = { ...stored, title };
        return null;
      }
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

test("documents open on the page of their kind", () => {
  expect(documentRoute("w", "map", "m1")).toEqual({
    to: "/world/$worldId/world/map/$mapId",
    params: { worldId: "w", mapId: "m1" },
  });
  expect(documentRoute("w", "card", "c1")).toEqual({
    to: "/world/$worldId/world/card/$cardId",
    params: { worldId: "w", cardId: "c1" },
  });
});

test('"New map" chooses a background, creates the map with one layer and opens it', async () => {
  const router = await renderAt("/world/demo/world");

  fireEvent.click(await screen.findByRole("button", { name: "Nouvelle map" }));
  expect(
    await screen.findByRole("dialog", { name: "Image de fond de la nouvelle map" }),
  ).toBeTruthy();
  fireEvent.click(await screen.findByRole("option", { name: "Terre du Milieu.png" }));
  fireEvent.click(screen.getByRole("button", { name: "Choisir" }));

  await waitFor(() => expect(router.state.location.pathname).toBe("/world/demo/world/map/m1"));
  expect(calls).toContainEqual({
    command: "create_map",
    payload: { title: "Map sans nom", backgroundAssetId: IMAGE.id, layerName: "Calque 1" },
  });
  expect(await screen.findByRole("application", { name: "Map Map sans nom" })).toBeTruthy();
});

test("a map shows its name, renamed as typed, and can be recentered", async () => {
  stored = map("Arda");
  await renderAt("/world/demo/world/map/m1");

  const title = await screen.findByLabelText("Nom de la map");
  expect((title as HTMLInputElement).value).toBe("Arda");
  expect(screen.getByRole("button", { name: "Recentrer" })).toBeTruthy();
  expect(calls).toContainEqual({ command: "mark_document_opened", payload: { id: "m1" } });

  fireEvent.change(title, { target: { value: "Terre du Milieu" } });
  fireEvent.blur(title);
  await waitFor(() =>
    expect(calls).toContainEqual({
      command: "rename_document",
      payload: { id: "m1", title: "Terre du Milieu" },
    }),
  );
});

test("a map whose background was deleted says so", async () => {
  stored = { ...map("Arda"), backgroundAssetId: null };
  await renderAt("/world/demo/world/map/m1");
  expect(
    await screen.findByText("L'image de fond de cette map n'est plus dans la médiathèque."),
  ).toBeTruthy();
});

test("layers: added on top and named at once, hidden, moved, deleted, and saved", async () => {
  stored = map("Arda");
  await renderAt("/world/demo/world/map/m1");

  fireEvent.click(await screen.findByRole("button", { name: "Nouveau calque" }));
  const name = await screen.findByLabelText("Nom du calque");
  fireEvent.change(name, { target: { value: "Villes" } });
  fireEvent.keyDown(name, { key: "Enter" });

  const list = screen.getByRole("list", { name: "Calques" });
  const rows = () => [...list.querySelectorAll("li")].map((li) => li.textContent);
  expect(rows()).toEqual(["Villes", "Calque 1"]);
  // The new layer is the active one.
  expect(screen.getByRole("button", { name: "Villes" }).getAttribute("aria-current")).toBe("true");

  fireEvent.click(screen.getByRole("button", { name: "Masquer le calque Villes" }));
  expect(
    screen.getByRole("button", { name: "Afficher le calque Villes" }).getAttribute("aria-pressed"),
  ).toBe("true");

  // Alt+↓ moves the focused layer one step down.
  fireEvent.keyDown(screen.getByRole("button", { name: "Villes" }), {
    key: "ArrowDown",
    altKey: true,
  });
  expect(rows()).toEqual(["Calque 1", "Villes"]);

  await waitFor(
    () =>
      expect(stored?.content.layers).toEqual([
        { id: expect.any(String), name: "Villes", visible: false },
        { id: "l1", name: "Calque 1", visible: true },
      ]),
    { timeout: 3000 },
  );
});

test("pins: added at the centre, labelled, hidden with their layer, deleted with the keyboard", async () => {
  stored = map("Arda");
  await renderAt("/world/demo/world/map/m1");

  fireEvent.click(await screen.findByRole("button", { name: "Ajouter un pin" }));
  const marker = await screen.findByRole("button", { name: "Pin Repère" });
  // The new pin is selected: its properties show.
  const label = await screen.findByLabelText("Libellé");
  fireEvent.change(label, { target: { value: "Minas Tirith" } });
  await waitFor(() => expect(marker.getAttribute("aria-label")).toBe("Pin Minas Tirith"));

  // Hidden with its layer.
  fireEvent.click(screen.getByRole("button", { name: "Masquer le calque Calque 1" }));
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Pin Minas Tirith" })).toBeNull(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Afficher le calque Calque 1" }));
  const shown = await screen.findByRole("button", { name: "Pin Minas Tirith" });

  await waitFor(
    () =>
      expect(stored?.content.pins).toEqual([
        expect.objectContaining({ label: "Minas Tirith", cardId: null, layerId: "l1", x: 0.5 }),
      ]),
    { timeout: 3000 },
  );

  fireEvent.keyDown(shown, { key: "Delete" });
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Pin Minas Tirith" })).toBeNull(),
  );
  await waitFor(() => expect(stored?.content.pins).toEqual([]), { timeout: 3000 });
});

test("a card is put on the map from its search, and its pin opens it", async () => {
  stored = map("Arda");
  const router = await renderAt("/world/demo/world/map/m1");

  fireEvent.click(await screen.findByRole("button", { name: "Ajouter une carte" }));
  fireEvent.click(await screen.findByRole("option", { name: /Gondor/ }));
  const pin = await screen.findByRole("button", { name: "Pin de la carte Gondor" });
  expect(await screen.findByRole("link", { name: "Ouvrir la carte" })).toBeTruthy();
  await waitFor(
    () => expect(stored?.content.pins).toEqual([expect.objectContaining({ cardId: "gondor" })]),
    { timeout: 3000 },
  );

  // Selected, Enter opens the card.
  fireEvent.keyDown(pin, { key: "Enter" });
  await waitFor(() => expect(router.state.location.pathname).toBe("/world/demo/world/card/gondor"));
});

test("a zone is selected, styled, linked to a card and its tool toggles tracing", async () => {
  stored = {
    ...map("Arda"),
    content: {
      ...map("Arda").content,
      zones: [
        {
          id: "z1",
          layerId: "l1",
          points: [
            [0.2, 0.2],
            [0.6, 0.2],
            [0.4, 0.6],
          ],
          label: "Mordor",
          labelStyle: { font: "serif", size: 18 },
          cardId: null,
          fillColor: "red",
          opacity: 0.4,
          pattern: "solid",
        },
      ],
    },
  };
  await renderAt("/world/demo/world/map/m1");

  const zone = await waitFor(() => {
    const path = document.querySelector('[aria-label="Zone Mordor"]');
    if (!path) throw new Error("zone not drawn");
    return path;
  });
  fireEvent.click(zone);
  fireEvent.click(await screen.findByRole("radio", { name: "Hachures" }));
  fireEvent.click(screen.getByRole("button", { name: "Lier à une carte" }));
  fireEvent.click(await screen.findByRole("option", { name: /Gondor/ }));
  await waitFor(
    () => expect(stored?.content.zones[0]).toMatchObject({ pattern: "hatch", cardId: "gondor" }),
    { timeout: 3000 },
  );

  const tool = screen.getByRole("button", { name: "Tracer une zone" });
  fireEvent.click(tool);
  expect(tool.getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByText(/Tracé d'une zone : 0 sommet\./)).toBeTruthy();
  fireEvent.keyDown(window, { key: "Escape" });
  await waitFor(() => expect(tool.getAttribute("aria-pressed")).toBe("false"));
});

test("a text is selected and bent, its tool waits for a click and Escape gives up", async () => {
  stored = {
    ...map("Arda"),
    content: {
      ...map("Arda").content,
      texts: [
        {
          id: "t1",
          layerId: "l1",
          x: 0.5,
          y: 0.2,
          text: "Terre du Milieu",
          style: { font: "serif", size: 28, spacing: 0, arc: 0, scaleWithZoom: true },
        },
      ],
    },
  };
  await renderAt("/world/demo/world/map/m1");

  fireEvent.click(await screen.findByRole("button", { name: "Texte Terre du Milieu" }));
  fireEvent.change(await screen.findByLabelText(/Courbure/), { target: { value: "-0.5" } });
  fireEvent.click(screen.getByRole("switch", { name: "Suit le zoom" }));
  await waitFor(
    () =>
      expect(stored?.content.texts[0]?.style).toMatchObject({ arc: -0.5, scaleWithZoom: false }),
    { timeout: 3000 },
  );

  const tool = screen.getByRole("button", { name: "Ajouter un texte" });
  fireEvent.click(tool);
  expect(tool.getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByText(/Cliquez sur la map pour poser le texte/)).toBeTruthy();
  fireEvent.keyDown(window, { key: "Escape" });
  await waitFor(() => expect(tool.getAttribute("aria-pressed")).toBe("false"));
});

test("a new background keeps the pins, zones and texts", async () => {
  stored = {
    ...map("Arda"),
    content: {
      ...map("Arda").content,
      pins: [
        {
          id: "p1",
          layerId: "l1",
          cardId: null,
          x: 0.3,
          y: 0.4,
          icon: "castle",
          color: "red",
          label: "Minas Tirith",
          size: 1,
        },
      ],
    },
  };
  await renderAt("/world/demo/world/map/m1");
  await screen.findByRole("button", { name: "Pin Minas Tirith" });

  fireEvent.click(screen.getByRole("button", { name: "Fond" }));
  fireEvent.click(await screen.findByRole("option", { name: "Arda remaniée.png" }));
  fireEvent.click(screen.getByRole("button", { name: "Choisir" }));

  await waitFor(() =>
    expect(calls).toContainEqual({
      command: "set_map_background",
      payload: { id: "m1", assetId: OTHER.id },
    }),
  );
  // Still there, at the same relative place, and nothing was saved over it.
  expect(await screen.findByRole("button", { name: "Pin Minas Tirith" })).toBeTruthy();
  expect(stored?.content.pins).toEqual([expect.objectContaining({ id: "p1", x: 0.3, y: 0.4 })]);
});

test("undo and redo, with the buttons and Ctrl+Z / Ctrl+Y, are saved too", async () => {
  stored = map("Arda");
  await renderAt("/world/demo/world/map/m1");
  const undo = await screen.findByRole("button", { name: "Annuler (Ctrl+Z)" });
  expect((undo as HTMLButtonElement).disabled).toBe(true);

  fireEvent.click(screen.getByRole("button", { name: "Ajouter un pin" }));
  await screen.findByRole("button", { name: "Pin Repère" });
  fireEvent.click(undo);
  await waitFor(() => expect(screen.queryByRole("button", { name: "Pin Repère" })).toBeNull());

  fireEvent.keyDown(document.body, { key: "y", ctrlKey: true });
  expect(await screen.findByRole("button", { name: "Pin Repère" })).toBeTruthy();
  fireEvent.keyDown(document.body, { key: "z", ctrlKey: true });
  await waitFor(() => expect(screen.queryByRole("button", { name: "Pin Repère" })).toBeNull());
  await waitFor(() => expect(calls.some((call) => call.command === "save_map")).toBe(true), {
    timeout: 3000,
  });
  expect(stored?.content.pins).toEqual([]);
});

test("a pause while typing the name loses no letter when the save comes back", async () => {
  stored = map("Arda");
  await renderAt("/world/demo/world/map/m1");
  const title = (await screen.findByLabelText("Nom de la map")) as HTMLInputElement;
  fireEvent.focus(title);
  slowReload = true;

  fireEvent.change(title, { target: { value: "Ter" } });
  // The pause: "Ter" is saved, and while the map comes back, "re" is typed.
  await waitFor(() =>
    expect(calls).toContainEqual({
      command: "rename_document",
      payload: { id: "m1", title: "Ter" },
    }),
  );
  fireEvent.change(title, { target: { value: "Terre" } });
  await new Promise((resolve) => setTimeout(resolve, 350));
  expect(stored?.title).toBe("Ter");
  expect(title.value).toBe("Terre");
});
