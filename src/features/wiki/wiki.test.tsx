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
  CardType,
  SearchHit,
  WikiPage,
  WikiSettings,
  WorldInfo,
} from "@/lib/bindings";
import { createQueryClient } from "@/lib/query";

const WORLD: WorldInfo = {
  id: "demo",
  name: "Eldefleur",
  genre: "fantasy",
  description: "",
  mainImage: null,
  theme: { kind: "default" },
  preferences: { entityDetection: true, autoMentionLinks: true, animateNewLinks: true },
  storageLimit: null,
  path: "C:\\Mondes\\Eldefleur",
  schemaVersion: 5,
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

function page(id: string, image: string | null = null, aliases: string[] = []): WikiPage {
  return { id, kind: "card", title: id, typeId: null, imageAssetId: image, aliases };
}

let wiki: WikiSettings;
let pages: WikiPage[];
let saved: WikiSettings[];
let searched: string[];

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

/** What the world's search finds: Aragorn by an alias, Arwen by her text, Gollum (no page). */
const HITS: SearchHit[] = [
  {
    id: "Aragorn",
    kind: "card",
    title: [{ text: "Aragorn", matched: false }],
    typeId: null,
    imageAssetId: null,
    match: {
      kind: "alias",
      alias: [
        { text: "Grands", matched: true },
        { text: "-Pas", matched: false },
      ],
    },
  },
  {
    id: "Gollum",
    kind: "card",
    title: [{ text: "Gollum", matched: false }],
    typeId: null,
    imageAssetId: null,
    match: { kind: "name" },
  },
  {
    id: "Arwen",
    kind: "card",
    title: [{ text: "Arwen", matched: false }],
    typeId: null,
    imageAssetId: null,
    match: {
      kind: "content",
      excerpt: [
        { text: "…l'étoile du ", matched: false },
        { text: "grand", matched: true },
      ],
    },
  },
];

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mockConvertFileSrc("windows");
  wiki = {
    title: "",
    description: "",
    bannerAssetId: null,
    featured: [],
    theme: { preset: "parchment" },
  };
  pages = [page("Aragorn", "aragorn.png", ["Grands-Pas"]), page("Arwen"), page("Minas Tirith")];
  pages[1] = { ...(pages[1] as WikiPage), typeId: "character" };
  pages.push({ ...page("Arda"), kind: "map" });
  saved = [];
  searched = [];
  mockIPC((command, args) => {
    switch (command) {
      case "current_world":
        return WORLD;
      case "get_settings":
        return SETTINGS;
      case "wiki_settings":
        return wiki;
      case "wiki_pages":
        return pages;
      case "save_wiki_settings": {
        wiki = (args as { settings: WikiSettings }).settings;
        saved.push(wiki);
        return wiki;
      }
      case "list_card_types":
        return TYPES;
      case "search_documents":
        searched.push((args as { query: string }).query);
        return HITS;
      case "list_assets":
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

async function renderWiki() {
  const queryClient = createQueryClient();
  const router = createAppRouter(
    queryClient,
    createMemoryHistory({ initialEntries: [`/world/${WORLD.id}/wiki`] }),
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
  return router;
}

const titleField = () => screen.findByRole("textbox", { name: "Titre du wiki" });

test("the title is the world's name until one is written, and saved when left", async () => {
  await renderWiki();
  const title = (await titleField()) as HTMLInputElement;
  expect(title.value).toBe("Eldefleur");

  fireEvent.change(title, { target: { value: "  Les  Protecteurs " } });
  fireEvent.blur(title);
  await waitFor(() => expect(saved.at(-1)?.title).toBe("Les Protecteurs"));

  // Escape gives the saved text back, without saving.
  fireEvent.change(title, { target: { value: "Autre" } });
  fireEvent.keyDown(title, { key: "Escape" });
  fireEvent.blur(title);
  expect(title.value).toBe("Les Protecteurs");
  expect(saved).toHaveLength(1);

  // Back to the world's name: no title of its own.
  fireEvent.change(title, { target: { value: "Eldefleur" } });
  fireEvent.blur(title);
  await waitFor(() => expect(saved.at(-1)?.title).toBe(""));
});

test("the description is saved when left", async () => {
  await renderWiki();
  const description = await screen.findByRole("textbox", { name: "Description du wiki" });
  fireEvent.change(description, { target: { value: "Un monde.\n\nDeux paragraphes." } });
  fireEvent.blur(description);
  await waitFor(() => expect(saved.at(-1)?.description).toBe("Un monde.\n\nDeux paragraphes."));
});

test("the search finds pages by name, alias or text, and only pages", async () => {
  await renderWiki();
  const search = await screen.findByRole("searchbox", { name: "Rechercher dans Eldefleur…" });
  fireEvent.change(search, { target: { value: "grand" } });
  const results = await screen.findByRole("list", { name: "Pages trouvées" });
  expect(searched).toContain("grand");
  expect(
    within(results)
      .getAllByRole("link")
      .map((link) => link.textContent),
  ).toEqual(["AragornGrands-Pas", "Arwen…l'étoile du grand"]);
  expect(
    within(results)
      .getByRole("link", { name: /Aragorn/ })
      .getAttribute("href"),
  ).toBe("/world/demo/wiki/card/Aragorn");
});

test("the bar: pages by type then maps, back, and « Ouvrir dans World » on a page", async () => {
  const router = await renderWiki();
  const bar = await screen.findByRole("navigation", { name: "Navigation du wiki" });
  expect(within(bar).queryByRole("link", { name: "Ouvrir dans World" })).toBeNull();
  await act(async () => {
    fireEvent.pointerDown(within(bar).getByRole("button", { name: "Pages" }), { button: 0 });
  });
  const menu = await screen.findByRole("menu");
  expect(
    within(menu)
      .getAllByRole("group")
      .map((group) => group.firstChild?.textContent),
  ).toEqual(["Personnage", "Sans type", "Maps"]);
  fireEvent.click(within(menu).getByRole("menuitem", { name: "Arwen" }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/world/demo/wiki/card/Arwen"));

  const world = await within(bar).findByRole("link", { name: "Ouvrir dans World" });
  expect(world.getAttribute("href")).toBe("/world/demo/world/card/Arwen");
  fireEvent.click(within(bar).getByRole("button", { name: "Retour" }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/world/demo/wiki"));
});

test("« Modifier la grille » adds, removes and keeps the order", async () => {
  wiki = { ...wiki, featured: ["Arwen", "Hidden"] };
  await renderWiki();
  const grid = await screen.findByRole("region", { name: "À la une" });
  expect(within(grid).getByRole("link", { name: "Arwen" })).toBeTruthy();

  fireEvent.click(within(grid).getByRole("button", { name: "Modifier la grille" }));
  await act(async () => {
    fireEvent.click(within(grid).getByRole("button", { name: "Ajouter une page" }));
  });
  // Already featured pages are not offered.
  const offer = await screen.findByRole("dialog");
  expect(within(offer).queryByRole("button", { name: "Arwen" })).toBeNull();
  fireEvent.click(within(offer).getByRole("button", { name: "Aragorn" }));
  await waitFor(() => expect(saved.at(-1)?.featured).toEqual(["Arwen", "Hidden", "Aragorn"]));

  fireEvent.click(within(grid).getByRole("button", { name: "Retirer Arwen de la grille" }));
  await waitFor(() => expect(saved.at(-1)?.featured).toEqual(["Hidden", "Aragorn"]));

  fireEvent.click(within(grid).getByRole("button", { name: "Terminé" }));
  expect(within(grid).getByRole("link", { name: "Aragorn" })).toBeTruthy();
});

test("the large image shows the featured pages with an image", async () => {
  wiki = { ...wiki, featured: ["Arwen", "Aragorn"] };
  await renderWiki();
  const hero = await screen.findByRole("region", { name: "Pages à la une" });
  // Arwen has no image: only Aragorn is in the slideshow.
  expect(within(hero).getByRole("link", { name: "Aragorn" })).toBeTruthy();
  expect(within(hero).queryByRole("link", { name: "Arwen" })).toBeNull();
});

test("without a page, the home page says how to make one", async () => {
  pages = [];
  await renderWiki();
  expect(await screen.findByText("Le wiki n'a pas encore de page")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Aller dans World" })).toBeTruthy();
});

test("the banner is chosen and removed", async () => {
  wiki = { ...wiki, bannerAssetId: "banner.png" };
  await renderWiki();
  fireEvent.click(await screen.findByRole("button", { name: "Retirer la bannière" }));
  await waitFor(() => expect(saved.at(-1)?.bannerAssetId).toBeNull());
  expect(screen.getByRole("button", { name: "Ajouter une bannière" })).toBeTruthy();
});
