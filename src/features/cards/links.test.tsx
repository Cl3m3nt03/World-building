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
  Backlink,
  Card,
  CardProperty,
  CardType,
  PropertyDefinition,
  PropertyValue,
  WorldInfo,
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
  preferences: { entityDetection: true, autoMentionLinks: true, animateNewLinks: true },
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
  cardType("city", "Ville", "place"),
];

function card(id: string, title: string, typeId: string, aliases: string[] = []): Card {
  return {
    id,
    title,
    typeId,
    imageAssetId: null,
    aliases,
    createdAt: "2026-09-27T10:00:00Z",
    updatedAt: "2026-09-27T10:00:00Z",
    trashedAt: null,
  };
}

const CARDS = [
  card("aragorn", "Aragorn", "character"),
  card("minas", "Minas Tirith", "city", ["Cité Blanche"]),
  card("gondor", "Gondor", "place"),
  card("gandalf", "Gandalf", "character"),
];

const BIRTHPLACE: PropertyDefinition = {
  id: "birthplace",
  owner: { on: "type", typeId: "character" },
  label: "Lieu de naissance",
  kind: "card",
  targetTypeIds: ["place"],
  relationTypeId: null,
  appliesToExisting: true,
  sortOrder: 0,
  createdAt: "2026-09-27T09:00:00Z",
};

type Call = { command: string; payload: unknown };
let calls: Call[];
let properties: CardProperty[];
let backlinks: Backlink[];

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mockConvertFileSrc("windows");
  calls = [];
  properties = [{ definition: BIRTHPLACE, value: null }];
  backlinks = [];
  mockIPC((command, payload) => {
    calls.push({ command, payload });
    const args = payload as Record<string, unknown>;
    switch (command) {
      case "current_world":
        return WORLD;
      case "get_sidebar_state":
        return {};
      case "get_settings":
        return SETTINGS;
      case "list_card_types":
        return TYPES;
      case "list_cards":
        return args.trashed ? [] : CARDS;
      case "get_card":
        return CARDS.find((c) => c.id === args.id);
      case "card_properties":
        return properties;
      case "card_backlinks":
        return backlinks;
      case "set_property_value":
        properties = properties.map((p) =>
          p.definition.id === args.propertyId
            ? { ...p, value: args.value as PropertyValue | null }
            : p,
        );
        return properties;
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

async function openPicker() {
  const trigger = await screen.findByRole("button", {
    name: "Choisir une carte pour Lieu de naissance",
  });
  await act(async () => {
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.click(trigger);
  });
  return screen.findByRole("combobox", { name: "Choisir une carte pour Lieu de naissance" });
}

test("the picker only offers the allowed types, a subtype counting as its type", async () => {
  await renderAt("/world/demo/world/card/aragorn");
  await openPicker();

  const options = await screen.findAllByRole("option");
  // Places and cities, not characters.
  expect(options.map((option) => option.textContent)).toEqual(["Minas Tirith", "Gondor"]);
});

test("searching by an alias and picking with the keyboard sets the link", async () => {
  await renderAt("/world/demo/world/card/aragorn");
  const search = await openPicker();

  fireEvent.change(search, { target: { value: "cité" } });
  expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
    "Minas Tirith",
  ]);
  fireEvent.keyDown(search, { key: "Enter" });

  await waitFor(() =>
    expect(callsOf("set_property_value")[0]?.payload).toEqual({
      cardId: "aragorn",
      propertyId: "birthplace",
      value: { kind: "card", value: "minas" },
    }),
  );
  // The chip opens the linked card, and can be removed.
  const props = screen.getByRole("region", { name: "Propriétés" });
  const chip = await within(props).findByRole("link", { name: "Minas Tirith" });
  expect(chip.getAttribute("href")).toContain("/world/demo/world/card/minas");
  fireEvent.click(screen.getByRole("button", { name: "Retirer le lien vers Minas Tirith" }));
  await waitFor(() =>
    expect(callsOf("set_property_value")[1]?.payload).toMatchObject({ value: null }),
  );
});

test("arrow keys move in the results", async () => {
  await renderAt("/world/demo/world/card/aragorn");
  const search = await openPicker();
  await screen.findAllByRole("option");

  fireEvent.keyDown(search, { key: "ArrowDown" });
  expect(screen.getByRole("option", { name: "Gondor" }).getAttribute("aria-selected")).toBe("true");
  fireEvent.keyDown(search, { key: "Enter" });

  await waitFor(() =>
    expect(callsOf("set_property_value")[0]?.payload).toMatchObject({
      value: { kind: "card", value: "gondor" },
    }),
  );
});

test("cited in lists the cards that cite this one, and how", async () => {
  backlinks = [
    {
      sourceId: "aragorn",
      sourceKind: "card",
      sourceTitle: "Aragorn",
      sourceTypeId: "character",
      via: [
        { kind: "property", propertyLabel: "Lieu de naissance" },
        { kind: "mention", propertyLabel: null },
      ],
    },
  ];
  const router = await renderAt("/world/demo/world/card/minas");

  const section = await screen.findByRole("region", { name: "Cité dans" });
  const link = await waitFor(() => {
    const found = section.querySelector("a");
    expect(found?.textContent).toBe("AragornLieu de naissance · mention");
    return found as HTMLAnchorElement;
  });
  fireEvent.click(link);
  await waitFor(() =>
    expect(router.state.location.pathname).toBe("/world/demo/world/card/aragorn"),
  );
});

test("cited in lists the trees that show this card, and opens them", async () => {
  backlinks = [
    {
      sourceId: "isildur-house",
      sourceKind: "tree",
      sourceTitle: "Maison d'Isildur",
      sourceTypeId: null,
      via: [{ kind: "tree", propertyLabel: null }],
    },
  ];
  const router = await renderAt("/world/demo/world/card/minas");

  const section = await screen.findByRole("region", { name: "Cité dans" });
  const link = await waitFor(() => {
    const found = section.querySelector("a");
    expect(found?.textContent).toBe("Maison d'Isildurarbre de relations");
    return found as HTMLAnchorElement;
  });
  fireEvent.click(link);
  await waitFor(() =>
    expect(router.state.location.pathname).toBe("/world/demo/world/tree/isildur-house"),
  );
});

test("no backlink: says so", async () => {
  await renderAt("/world/demo/world/card/gondor");
  expect(await screen.findByText("Rien ne cite cette carte pour l'instant.")).toBeTruthy();
});
