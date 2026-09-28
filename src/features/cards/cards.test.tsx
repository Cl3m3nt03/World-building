// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { clearMocks, mockConvertFileSrc, mockIPC } from "@tauri-apps/api/mocks";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createAppRouter } from "@/app/router";
import { useUiStore } from "@/app/stores/ui";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { AppSettings, Card, CardType, WorldInfo } from "@/lib/bindings";
import { createQueryClient } from "@/lib/query";

const WORLD: WorldInfo = {
  id: "demo",
  name: "Eldefleur",
  path: "C:/Worlds/Eldefleur",
  genre: "fantasy",
  description: "",
  mainImage: null,
  theme: { kind: "default" },
  preferences: { entityDetection: true, autoMentionLinks: true, animateNewLinks: true },
  schemaVersion: 5,
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

function cardType(id: string, name: string, extra: Partial<CardType> = {}): CardType {
  return {
    id,
    parentId: null,
    name,
    icon: "user",
    color: "blue",
    guidedTemplate: [],
    orientation: "portrait",
    canvasFormat: "standard",
    sortOrder: 0,
    ...extra,
  };
}

const TYPES = [
  cardType("character", "Personnage"),
  cardType("place", "Lieu", { icon: "map-pin", color: "green", orientation: "landscape" }),
  cardType("city", "Ville", { parentId: "place", icon: "map-pin", color: "green" }),
];

type Call = { command: string; payload: unknown };
let calls: Call[];
let cards: Map<string, Card>;

function newCard(id: string, title: string, typeId: string): Card {
  return {
    id,
    title,
    typeId,
    imageAssetId: null,
    aliases: [],
    createdAt: "2026-09-27T10:00:00Z",
    updatedAt: "2026-09-27T10:00:00Z",
    trashedAt: null,
  };
}

function update(id: string, change: Partial<Card>) {
  const card = { ...(cards.get(id) as Card), ...change };
  cards.set(id, card);
  return card;
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mockConvertFileSrc("windows");
  useUiStore.setState({ focusCardTitle: null, cardTypesOpen: false });
  calls = [];
  cards = new Map([["aragorn", newCard("aragorn", "Aragorn", "character")]]);
  mockIPC((command, payload) => {
    calls.push({ command, payload });
    const args = payload as Record<string, unknown>;
    switch (command) {
      case "current_world":
        return WORLD;
      case "get_settings":
        return SETTINGS;
      case "list_card_types":
        return TYPES;
      case "get_card":
        return cards.get(args.id as string);
      case "list_cards":
        return [...cards.values()].filter((card) => (card.trashedAt !== null) === args.trashed);
      case "create_card": {
        const card = newCard("new", args.title as string, args.typeId as string);
        cards.set(card.id, card);
        return card;
      }
      case "rename_document":
        update(args.id as string, { title: args.title as string });
        return {};
      case "set_card_type":
        return update(args.id as string, { typeId: args.typeId as string });
      case "set_card_aliases":
        return update(args.id as string, { aliases: args.aliases as string[] });
      case "trash_document":
        return update(args.id as string, { trashedAt: "2026-09-27T11:00:00Z" });
      case "restore_document":
        return update(args.id as string, { trashedAt: null });
      case "delete_document":
        cards.delete(args.id as string);
        return null;
      case "empty_trash": {
        const trashed = [...cards.values()].filter((card) => card.trashedAt !== null);
        for (const card of trashed) cards.delete(card.id);
        return trashed.length;
      }
      default:
        return undefined;
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

const callsOf = (command: string) => calls.filter((call) => call.command === command);

/** Opens a Radix menu the keyboard way (Enter on its focused trigger). */
async function openMenu(trigger: HTMLElement) {
  await act(async () => {
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
  });
}

test("the Card tile creates a card of the chosen type and opens it, title selected", async () => {
  const router = await renderAt("/world/demo/world");

  await openMenu(screen.getByRole("button", { name: "Carte" }));
  await act(async () => {
    fireEvent.click(await screen.findByRole("menuitem", { name: "Ville" }));
  });

  await waitFor(() => expect(router.state.location.pathname).toBe("/world/demo/world/card/new"));
  expect(callsOf("create_card")[0]?.payload).toEqual({ typeId: "city", title: "Ville sans nom" });
  const title = (await screen.findByLabelText("Nom de la carte")) as HTMLInputElement;
  await waitFor(() => expect(document.activeElement).toBe(title));
  expect(title.value).toBe("Ville sans nom");
});

test("the creation menu offers to make a new type", async () => {
  await renderAt("/world/demo/world");

  await openMenu(screen.getByRole("button", { name: "Carte" }));
  await act(async () => {
    fireEvent.click(await screen.findByRole("menuitem", { name: "Nouveau type" }));
  });

  expect(useUiStore.getState().cardTypesOpen).toBe(true);
});

test("the card page renames the card as typed", async () => {
  await renderAt("/world/demo/world/card/aragorn");
  const title = await screen.findByLabelText("Nom de la carte");

  fireEvent.change(title, { target: { value: "Aragorn II" } });
  fireEvent.blur(title);

  await waitFor(() =>
    expect(callsOf("rename_document")[0]?.payload).toEqual({ id: "aragorn", title: "Aragorn II" }),
  );
});

test("changes the type, adds and removes aliases", async () => {
  await renderAt("/world/demo/world/card/aragorn");

  await openMenu(await screen.findByRole("button", { name: "Type : Personnage. Changer le type" }));
  await act(async () => {
    fireEvent.click(await screen.findByRole("menuitemradio", { name: "Ville" }));
  });
  expect(
    await screen.findByRole("button", { name: "Type : Lieu › Ville. Changer le type" }),
  ).toBeTruthy();

  const alias = screen.getByLabelText("Nouvel alias");
  fireEvent.change(alias, { target: { value: "Grands-Pas" } });
  fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));
  expect(await screen.findByRole("button", { name: "Retirer l'alias Grands-Pas" })).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Retirer l'alias Grands-Pas" }));
  await waitFor(() => expect(callsOf("set_card_aliases")).toHaveLength(2));
  expect(callsOf("set_card_aliases").map((call) => call.payload)).toEqual([
    { id: "aragorn", aliases: ["Grands-Pas"] },
    { id: "aragorn", aliases: [] },
  ]);
});

test("moving a card to the trash goes back to the empty workspace", async () => {
  const router = await renderAt("/world/demo/world/card/aragorn");

  await openMenu(await screen.findByRole("button", { name: "Actions de la carte" }));
  await act(async () => {
    fireEvent.click(await screen.findByRole("menuitem", { name: "Mettre à la corbeille" }));
  });

  await waitFor(() => expect(router.state.location.pathname).toBe("/world/demo/world"));
  expect(callsOf("trash_document")[0]?.payload).toEqual({ id: "aragorn" });
});

test("the sidebar lists the cards and highlights the open one", async () => {
  cards.set("bree", newCard("bree", "Bree", "city"));
  await renderAt("/world/demo/world/card/aragorn");

  const list = await screen.findByRole("list", { name: "Cartes" });
  const links = await waitFor(() => {
    const found = Array.from(list.querySelectorAll("a"));
    expect(found).toHaveLength(2);
    return found;
  });
  expect(links.map((link) => link.textContent)).toEqual(["Aragorn", "Bree"]);
  expect(links[0]?.getAttribute("aria-current")).toBe("page");
  expect(links[1]?.getAttribute("aria-current")).toBeNull();
});

test("a right click in the sidebar and the New card button open the creation menu", async () => {
  await renderAt("/world/demo/world");
  const sidebar = await screen.findByRole("complementary", { name: "Barre latérale" });

  await act(async () => {
    fireEvent.contextMenu(sidebar.querySelector("ul, p") as HTMLElement);
  });
  expect(await screen.findByRole("menuitem", { name: "Personnage" })).toBeTruthy();
  await act(async () => {
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
  });

  await openMenu(screen.getByRole("button", { name: "Nouvelle carte" }));
  await act(async () => {
    fireEvent.click(await screen.findByRole("menuitem", { name: "Lieu" }));
  });
  await waitFor(() =>
    expect(callsOf("create_card")[0]?.payload).toEqual({ typeId: "place", title: "Lieu sans nom" }),
  );
});

test("the trash restores, deletes for good and empties after confirmation", async () => {
  cards.set("gollum", { ...newCard("gollum", "Gollum", "character"), trashedAt: "x" });
  cards.set("saruman", { ...newCard("saruman", "Saroumane", "character"), trashedAt: "x" });
  cards.set("smaug", { ...newCard("smaug", "Smaug", "character"), trashedAt: "x" });
  await renderAt("/world/demo/world");

  fireEvent.click(await screen.findByRole("button", { name: "Corbeille" }));
  fireEvent.click(await screen.findByRole("button", { name: "Restaurer Gollum" }));
  await waitFor(() => expect(callsOf("restore_document")[0]?.payload).toEqual({ id: "gollum" }));

  fireEvent.click(screen.getByRole("button", { name: "Supprimer définitivement Saroumane" }));
  await waitFor(() => expect(callsOf("delete_document")[0]?.payload).toEqual({ id: "saruman" }));

  await screen.findByRole("button", { name: "Restaurer Smaug" });
  await waitFor(() => expect(screen.queryByText("Saroumane")).toBeNull());
  fireEvent.click(screen.getByRole("button", { name: "Vider la corbeille" }));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Supprimer définitivement la carte de la corbeille ?",
  );
  fireEvent.click(screen.getByRole("button", { name: "Vider définitivement" }));
  await waitFor(() => expect(callsOf("empty_trash")).toHaveLength(1));
});
