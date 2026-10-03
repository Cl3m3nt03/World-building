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
  WikiPage,
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
  preferences: { entityDetection: false, autoMentionLinks: false, animateNewLinks: false },
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

const TYPES: CardType[] = [
  {
    id: "character",
    parentId: null,
    name: "Personnage",
    icon: "user",
    color: "blue",
    guidedTemplate: [],
    orientation: "portrait",
    canvasFormat: "standard",
    sortOrder: 0,
  },
];

function card(id: string, title: string): Card {
  return {
    id,
    title,
    typeId: "character",
    imageAssetId: null,
    aliases: [],
    createdAt: "2026-09-27T10:00:00Z",
    updatedAt: "2026-09-27T10:00:00Z",
    trashedAt: null,
  };
}

const CARDS = [card("aragorn", "Aragorn"), card("gondor", "Gondor"), card("minas", "Minas Tirith")];

function page(c: Card): WikiPage {
  return {
    id: c.id,
    kind: "card",
    title: c.title,
    typeId: c.typeId,
    imageAssetId: null,
    aliases: [],
  };
}

function mention(id: string, label: string) {
  return { type: "mention", attrs: { id, label } };
}

/** Aragorn's text: a mention of Gondor (a page) and of Minas Tirith (not one). */
const CONTENT = [
  {
    id: "b1",
    type: "text",
    doc: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Roi du " },
            mention("gondor", "Gondor"),
            { type: "text", text: ", né à " },
            mention("minas", "Minas Tirith"),
          ],
        },
      ],
    },
  },
];

let pages: WikiPage[];
let properties: CardProperty[];
let backlinks: Backlink[];

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mockConvertFileSrc("windows");
  pages = [page(CARDS[0] as Card), page(CARDS[1] as Card)];
  properties = [
    {
      definition: {
        id: "home",
        owner: { on: "type", typeId: "character" },
        label: "Patrie",
        kind: "cards",
        targetTypeIds: [],
        relationTypeId: null,
        appliesToExisting: true,
        sortOrder: 0,
        createdAt: "2026-09-27T09:00:00Z",
      },
      value: { kind: "cards", value: ["gondor", "minas"] },
    },
  ];
  backlinks = [
    {
      sourceId: "gondor",
      sourceKind: "card",
      sourceTitle: "Gondor",
      sourceTypeId: "character",
      via: [{ kind: "mention", propertyLabel: null }],
    },
    {
      sourceId: "minas",
      sourceKind: "card",
      sourceTitle: "Minas Tirith",
      sourceTypeId: "character",
      via: [{ kind: "mention", propertyLabel: null }],
    },
  ];
  mockIPC((command, payload) => {
    const args = payload as Record<string, unknown>;
    switch (command) {
      case "current_world":
        return WORLD;
      case "get_settings":
        return SETTINGS;
      case "list_card_types":
        return TYPES;
      case "list_cards":
        return args.trashed ? [] : CARDS;
      case "get_card":
        return CARDS.find((c) => c.id === args.id);
      case "get_card_content":
        return JSON.stringify(args.id === "aragorn" ? CONTENT : []);
      case "card_properties":
        return args.cardId === "aragorn" ? properties : [];
      case "card_backlinks":
        return args.cardId === "aragorn" ? backlinks : [];
      case "wiki_pages":
        return pages;
      case "wiki_settings":
        return { title: "", description: "", bannerAssetId: null, featured: [], theme: {} };
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

test("a mention of a page opens it in the wiki; of a card without a page, plain text", async () => {
  const router = await renderAt("/world/demo/wiki/card/aragorn");
  const page = await screen.findByRole("article", { name: "Aragorn" });
  expect(within(page).getByRole("heading", { level: 1, name: "Aragorn" })).toBeTruthy();
  const gondor = await within(page).findByRole("link", { name: "Ouvrir la carte Gondor" });
  expect(within(page).queryByRole("link", { name: "Ouvrir la carte Minas Tirith" })).toBeNull();
  expect(page.querySelector(".mention-plain")?.textContent).toBe("Minas Tirith");

  fireEvent.click(gondor);
  await waitFor(() => expect(router.state.location.pathname).toBe("/world/demo/wiki/card/gondor"));
});

test("a link property links the pages only", async () => {
  await renderAt("/world/demo/wiki/card/aragorn");
  const value = await screen.findByRole("list", { name: "Patrie" });
  expect(within(value).getByRole("link", { name: "Gondor" }).getAttribute("href")).toBe(
    "/world/demo/wiki/card/gondor",
  );
  expect(within(value).getByText("Minas Tirith").closest("a")).toBeNull();
});

test("« Cité dans » lists the pages only", async () => {
  await renderAt("/world/demo/wiki/card/aragorn");
  const cited = await screen.findByRole("region", { name: "Cité dans" });
  await within(cited).findByRole("link", { name: /Gondor/ });
  expect(within(cited).queryByText("Minas Tirith")).toBeNull();
});

test("a card without a page says so", async () => {
  await renderAt("/world/demo/wiki/card/minas");
  expect(await screen.findByText("Cette carte n'est pas visible dans le wiki.")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Accueil du wiki" })).toBeTruthy();
});
