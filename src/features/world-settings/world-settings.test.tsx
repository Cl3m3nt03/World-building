// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { clearMocks, mockConvertFileSrc, mockIPC } from "@tauri-apps/api/mocks";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createAppRouter } from "@/app/router";
import { useUiStore } from "@/app/stores/ui";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { AppSettings, Asset, WorldInfo, WorldPatch, WorldPreferences } from "@/lib/bindings";
import { createQueryClient } from "@/lib/query";

const IMAGE: Asset = {
  id: `${"a".repeat(64)}.png`,
  name: "Aldoria.png",
  kind: "image",
  mime: "image/png",
  size: 1024,
  width: 64,
  height: 64,
  createdAt: "2026-09-26T10:00:00Z",
};

const WORLD: WorldInfo = {
  id: "0b6c3f5e-8d1a-4c1b-9d4e-2f0a7b3c5d6e",
  name: "Aldoria",
  genre: "fantasy",
  description: "",
  mainImage: null,
  theme: { kind: "default" },
  preferences: { entityDetection: true, autoMentionLinks: true, animateNewLinks: true },
  path: "C:\\Mondes\\Aldoria",
  schemaVersion: 6,
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

type Call = { command: string; payload: unknown };
let calls: Call[];
let world: WorldInfo | null;
let deleteFails: boolean;

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mockConvertFileSrc("windows");
  useUiStore.setState({ worldSettings: null, cardTypesOpen: false });
  calls = [];
  world = { ...WORLD };
  deleteFails = false;
  mockIPC((command, payload) => {
    calls.push({ command, payload });
    switch (command) {
      case "current_world":
        return world;
      case "get_settings":
        return SETTINGS;
      case "list_assets":
        return [IMAGE];
      case "list_card_types":
      case "recent_documents":
      case "count_cards_by_type":
      case "list_cards":
        return [];
      case "update_world": {
        const { patch } = payload as { patch: WorldPatch };
        if (world) {
          world = {
            ...world,
            name: patch.name ?? world.name,
            genre: patch.genre ?? world.genre,
            description: patch.description ?? world.description,
          };
        }
        return world;
      }
      case "set_world_main_image":
        if (world) world = { ...world, mainImage: (payload as { assetId: string | null }).assetId };
        return world;
      case "set_world_preferences":
        if (world)
          world = {
            ...world,
            preferences: (payload as { preferences: WorldPreferences }).preferences,
          };
        return world;
      case "delete_world":
        if (deleteFails) throw { code: "io", message: "recycle bin: access denied" };
        world = null;
        return SETTINGS;
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

/** The app on the world's Home tab, with the world settings open. */
async function renderSettings() {
  const queryClient = createQueryClient();
  const router = createAppRouter(
    queryClient,
    createMemoryHistory({ initialEntries: [`/world/${WORLD.id}/home`] }),
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
  act(() => useUiStore.getState().openWorldSettings());
  const dialog = await screen.findByRole("dialog", { name: "Réglages du monde" });
  return { router, dialog };
}

const updates = () => calls.filter((call) => call.command === "update_world");

test("the world button of the top bar opens the general section", async () => {
  await renderSettings();
  act(() => useUiStore.getState().closeWorldSettings());
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

  fireEvent.click(screen.getByRole("button", { name: /Monde courant : Aldoria/ }));

  const dialog = await screen.findByRole("dialog", { name: "Réglages du monde" });
  expect(within(dialog).getByRole("tab", { name: "Général" }).getAttribute("aria-selected")).toBe(
    "true",
  );
  expect(within(dialog).getByText("C:\\Mondes\\Aldoria")).toBeTruthy();
});

test("the sections are reached with the up and down arrows", async () => {
  const { dialog } = await renderSettings();
  const general = within(dialog).getByRole("tab", { name: "Général" });

  act(() => general.focus());
  fireEvent.keyDown(general, { key: "ArrowDown" });

  // Radix moves the focus on the next tick.
  const types = within(dialog).getByRole("tab", { name: "Types" });
  await waitFor(() => expect(document.activeElement).toBe(types));
  await waitFor(() => expect(useUiStore.getState().worldSettings).toBe("types"));
});

test("saves the name after typing, without a button", async () => {
  await renderSettings();

  fireEvent.change(screen.getByLabelText("Nom"), { target: { value: "Aldoria II" } });

  await waitFor(() =>
    expect(updates()).toContainEqual({
      command: "update_world",
      payload: { patch: { name: "Aldoria II" } },
    }),
  );
});

test("never saves an empty name", async () => {
  await renderSettings();

  fireEvent.change(screen.getByLabelText("Nom"), { target: { value: "  " } });

  expect(screen.getByText(/Le nom ne peut pas être vide/)).toBeTruthy();
  await new Promise((resolve) => setTimeout(resolve, 700));
  expect(updates()).toHaveLength(0);
});

test("a description typed just before leaving the section is saved", async () => {
  await renderSettings();

  fireEvent.change(screen.getByLabelText("Description"), {
    target: { value: "Un royaume du nord." },
  });
  // Leaving right away: the pending change is saved without waiting.
  act(() => useUiStore.getState().openWorldSettings("types"));

  await waitFor(() =>
    expect(updates()).toContainEqual({
      command: "update_world",
      payload: { patch: { description: "Un royaume du nord." } },
    }),
  );
});

test("sets the main image through the picker, which becomes the backdrop", async () => {
  await renderSettings();

  fireEvent.click(screen.getByRole("button", { name: "Choisir une image" }));
  fireEvent.doubleClick(await screen.findByRole("option", { name: "Aldoria.png" }));

  await waitFor(() =>
    expect(calls).toContainEqual({
      command: "set_world_main_image",
      payload: { assetId: IMAGE.id },
    }),
  );
  await screen.findByRole("button", { name: "Changer d'image" });
  const backdrop = document.querySelector("div[aria-hidden] > img");
  expect(backdrop?.getAttribute("src")).toBe(`http://bzasset.localhost/${IMAGE.id}`);
});

test("the types and media sections lead to their screens", async () => {
  const { router, dialog } = await renderSettings();

  // Radix tabs are chosen on mouse down (and with the arrow keys).
  fireEvent.mouseDown(within(dialog).getByRole("tab", { name: "Types" }));
  fireEvent.click(await screen.findByRole("button", { name: "Gérer les types" }));
  expect(useUiStore.getState()).toMatchObject({ worldSettings: null, cardTypesOpen: true });

  act(() => useUiStore.setState({ cardTypesOpen: false, worldSettings: "media" }));
  const settings = await screen.findByRole("dialog", { name: "Réglages du monde" });
  expect(await within(settings).findByText("1 fichier")).toBeTruthy();
  fireEvent.click(within(settings).getByRole("button", { name: "Ouvrir la médiathèque" }));
  expect(useUiStore.getState().worldSettings).toBeNull();
  await waitFor(() => expect(router.state.location.pathname).toBe(`/world/${WORLD.id}/media`));
});

test("deleting the world asks for its name, then goes back to the world list", async () => {
  const { router } = await renderSettings();
  act(() => useUiStore.getState().openWorldSettings("preferences"));

  fireEvent.click(await screen.findByRole("button", { name: "Supprimer le monde" }));
  const confirm = await screen.findByRole("alertdialog", { name: "Supprimer « Aldoria » ?" });
  const submit = within(confirm).getByRole("button", { name: "Supprimer le monde" });
  const input = within(confirm).getByLabelText(/tapez le nom du monde/);

  fireEvent.change(input, { target: { value: "aldoria" } });
  expect(submit.hasAttribute("disabled")).toBe(true);
  fireEvent.change(input, { target: { value: "Aldoria " } });
  expect(submit.hasAttribute("disabled")).toBe(false);
  fireEvent.click(submit);

  await waitFor(() => expect(router.state.location.pathname).toBe("/"));
  expect(calls.filter((call) => call.command === "delete_world")).toHaveLength(1);
  // The next world opens without the settings screen.
  expect(useUiStore.getState().worldSettings).toBeNull();
});

test("a failed deletion is said and the world stays open", async () => {
  deleteFails = true;
  const { router } = await renderSettings();
  act(() => useUiStore.getState().openWorldSettings("preferences"));

  fireEvent.click(await screen.findByRole("button", { name: "Supprimer le monde" }));
  const confirm = await screen.findByRole("alertdialog");
  fireEvent.change(within(confirm).getByLabelText(/tapez le nom du monde/), {
    target: { value: "Aldoria" },
  });
  fireEvent.click(within(confirm).getByRole("button", { name: "Supprimer le monde" }));

  expect(await within(confirm).findByRole("alert")).toBeTruthy();
  expect(router.state.location.pathname).toBe(`/world/${WORLD.id}/home`);
});

test("the writing preferences are all on by default and saved when switched", async () => {
  const { dialog } = await renderSettings();
  act(() => useUiStore.getState().openWorldSettings("preferences"));

  const autoLinks = await within(dialog).findByRole("switch", {
    name: "Liens automatiques des mentions",
  });
  for (const name of [
    "Détection d'entités",
    "Liens automatiques des mentions",
    "Animer les nouveaux liens",
  ]) {
    expect(within(dialog).getByRole("switch", { name }).getAttribute("aria-checked")).toBe("true");
  }

  fireEvent.click(autoLinks);

  await waitFor(() =>
    expect(calls).toContainEqual({
      command: "set_world_preferences",
      payload: {
        preferences: { entityDetection: true, autoMentionLinks: false, animateNewLinks: true },
      },
    }),
  );
  await waitFor(() => expect(autoLinks.getAttribute("aria-checked")).toBe("false"));
});
