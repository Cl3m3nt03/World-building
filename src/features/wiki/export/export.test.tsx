// @vitest-environment jsdom
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import i18next, { type TFunction } from "i18next";
import { afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { initI18n } from "@/i18n";
import type {
  Card,
  CardProperty,
  SiteFile,
  WikiPage,
  WikiSettings,
  Map as WorldMap,
} from "@/lib/bindings";
import { exportWiki } from "./exportWiki";
import { assetFile } from "./site";

let t: TFunction;
beforeAll(async () => {
  await initI18n("fr");
  t = i18next.t.bind(i18next) as TFunction;
});

function card(id: string, title: string, imageAssetId: string | null = null): Card {
  return {
    id,
    title,
    typeId: "character",
    imageAssetId,
    aliases: [],
    createdAt: "2026-09-27T10:00:00Z",
    updatedAt: "2026-09-27T10:00:00Z",
    trashedAt: null,
  };
}

const IMAGE = `${"a".repeat(64)}.png`;
const BANNER = `${"b".repeat(64)}.png`;
const BACKGROUND = `${"c".repeat(64)}.png`;
const CARDS = [card("alvar", "Alvar", IMAGE), card("apex", "Apex"), card("ghost", "Guardian")];

const PAGES: WikiPage[] = [
  {
    id: "alvar",
    kind: "card",
    title: "Alvar",
    typeId: "character",
    imageAssetId: IMAGE,
    aliases: ["Le Gardien"],
  },
  { id: "apex", kind: "card", title: "Apex", typeId: "character", imageAssetId: null, aliases: [] },
  { id: "arda", kind: "map", title: "Arda", typeId: null, imageAssetId: null, aliases: [] },
];

const SETTINGS: WikiSettings = {
  title: "Les Protecteurs",
  description: "Un monde.\n\nDeux paragraphes.",
  bannerAssetId: BANNER,
  featured: ["alvar", "apex"],
  theme: { preset: "night" },
};

const ARDA: WorldMap = {
  id: "arda",
  title: "Arda",
  backgroundAssetId: BACKGROUND,
  width: 1000,
  height: 500,
  tiled: false,
  content: {
    layers: [{ id: "l1", name: "Calque", visible: true }],
    pins: [
      {
        id: "p1",
        layerId: "l1",
        cardId: "apex",
        x: 0.5,
        y: 0.5,
        icon: "",
        color: "",
        label: "",
        size: 1,
      },
      {
        id: "p2",
        layerId: "l1",
        cardId: "ghost",
        x: 0.2,
        y: 0.2,
        icon: "",
        color: "",
        label: "",
        size: 1,
      },
    ],
    zones: [],
    texts: [],
  },
};

const ALVAR_CONTENT = [
  {
    id: "b1",
    type: "text",
    doc: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Ami de " },
            { type: "mention", attrs: { id: "apex", label: "Apex" } },
            { type: "text", text: ", rival de " },
            { type: "mention", attrs: { id: "ghost", label: "Guardian" } },
            { type: "text", text: " ; gardien des cristaux." },
          ],
        },
      ],
    },
  },
  { id: "b2", type: "map", mapId: "arda" },
];

const PROPERTIES: CardProperty[] = [
  {
    definition: {
      id: "allies",
      owner: { on: "type", typeId: "character" },
      label: "Alliés",
      kind: "cards",
      targetTypeIds: [],
      relationTypeId: null,
      appliesToExisting: true,
      sortOrder: 0,
      createdAt: "2026-09-27T09:00:00Z",
    },
    value: { kind: "cards", value: ["apex", "ghost"] },
  },
];

let written: SiteFile[];
let copied: string[];
let started: { parent: string; title: string } | null;

beforeEach(() => {
  written = [];
  copied = [];
  started = null;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(new Uint8Array([1, 2, 3]))),
  );
  mockIPC((command, payload) => {
    const args = payload as Record<string, unknown>;
    switch (command) {
      case "wiki_settings":
        return SETTINGS;
      case "wiki_pages":
        return PAGES;
      case "list_card_types":
        return [
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
      case "list_cards":
        return CARDS;
      case "get_card":
        return CARDS.find((c) => c.id === args.id);
      case "get_card_content":
        return JSON.stringify(args.id === "alvar" ? ALVAR_CONTENT : []);
      case "card_properties":
        return args.cardId === "alvar" ? PROPERTIES : [];
      case "card_backlinks":
        return args.cardId === "apex"
          ? [
              {
                sourceId: "alvar",
                sourceKind: "card",
                sourceTitle: "Alvar",
                sourceTypeId: "character",
                via: [],
              },
              {
                sourceId: "ghost",
                sourceKind: "card",
                sourceTitle: "Guardian",
                sourceTypeId: "character",
                via: [],
              },
            ]
          : [];
      case "get_map":
        return ARDA;
      case "start_wiki_export":
        started = args as { parent: string; title: string };
        return "C:/Sites/Les Protecteurs - wiki";
      case "write_wiki_export":
        written.push(...(args.files as SiteFile[]));
        return null;
      case "copy_wiki_export_assets":
        copied.push(...(args.ids as string[]));
        return (args.ids as string[]).length;
      default:
        return null;
    }
  });
});

afterEach(() => {
  clearMocks();
  vi.unstubAllGlobals();
});

async function run() {
  const steps: string[] = [];
  const dir = await exportWiki({
    parent: "C:/Sites",
    worldName: "Eldefleur",
    t,
    language: "fr",
    typeColors: { "--bz-type-blue": "#7aa7f5" },
    onProgress: ({ step }) => steps.push(step),
  });
  return { dir, steps };
}

const file = (path: string) => written.find((candidate) => candidate.path === path)?.content ?? "";

test("writes the home page, a page per page, the search, styles and fonts, then the images", async () => {
  const { dir, steps } = await run();
  expect(dir).toBe("C:/Sites/Les Protecteurs - wiki");
  expect(started).toEqual({ parent: "C:/Sites", title: "Les Protecteurs" });
  expect(written.map((f) => f.path).sort()).toEqual([
    "fonts.css",
    "index.html",
    "pages/alvar.html",
    "pages/apex.html",
    "pages/arda.html",
    "search.js",
    "site.js",
    "style.css",
  ]);
  expect(copied.sort()).toEqual([BANNER, BACKGROUND, IMAGE].sort());
  expect(steps).toContain("read");
  expect(steps.at(-1)).toBe("assets");
});

test("no dead link: every link leads to a file of the site", async () => {
  await run();
  const pages = new Set([
    ...written.map((f) => f.path),
    ...copied.map((id) => `assets/${assetFile(id)}`),
  ]);
  for (const { path, content } of written.filter((f) => f.path.endsWith(".html"))) {
    const base = path.startsWith("pages/") ? "../" : "";
    for (const [, target] of content.matchAll(/(?:href|src)="([^"]+)"/g)) {
      if (!target) continue;
      const relative = target.startsWith(base) ? target.slice(base.length) : target;
      expect(pages.has(relative), `${path} → ${target}`).toBe(true);
    }
  }
});

test("the card page: mentions and links to pages, names only otherwise, « Cité dans » pages only", async () => {
  await run();
  const alvar = file("pages/alvar.html");
  expect(alvar).toContain('<a class="mention" href="../pages/apex.html">Apex</a>');
  expect(alvar).toContain('<span class="mention-plain">Guardian</span>');
  expect(alvar).toContain("Alliés");
  expect(alvar).toContain(`src="../assets/${"a".repeat(16)}.png"`);
  // The map block draws Arda, linked to its page.
  expect(alvar).toContain('href="../pages/arda.html"');
  const apex = file("pages/apex.html");
  expect(apex).toContain('href="../pages/alvar.html">Alvar</a>');
  expect(apex).not.toContain("Guardian");
});

test("the home page and the map page", async () => {
  await run();
  const home = file("index.html");
  expect(home).toContain("<h1>Les Protecteurs</h1>");
  expect(home).toContain("<p>Deux paragraphes.</p>");
  expect(home).toContain(`src="assets/${"b".repeat(16)}.png"`);
  expect(home).toContain('href="pages/alvar.html"');
  const arda = file("pages/arda.html");
  expect(arda).toContain('<a class="pin" href="../pages/apex.html"');
  expect(arda).toMatch(/<span class="pin"[^>]*>.*Guardian/);
});

test("the search index has names, aliases and text; the styles have the theme", async () => {
  await run();
  const index = file("search.js");
  expect(index.startsWith("window.BZ_SEARCH = ")).toBe(true);
  const data = JSON.parse(index.slice("window.BZ_SEARCH = ".length).replace(/;\s*$/, ""));
  expect(data.pages[0]).toMatchObject({ u: "pages/alvar.html", t: "Alvar", a: ["Le Gardien"] });
  expect(data.pages[0].x).toContain("Ami de Apex, rival de Guardian ; gardien des cristaux.");
  const style = file("style.css");
  expect(style).toContain("--wiki-background: #14161f;");
  expect(style).toContain("--bz-type-blue: #7aa7f5;");
  expect(style).toContain("--scheme: dark;");
  const fonts = file("fonts.css");
  expect(fonts).toContain('font-family: "Cinzel Variable"');
  expect(fonts).toContain('font-family: "Lora Variable"');
  expect(fonts).toContain("data:font/woff2;base64,AQID");
});

test("images are named as the Rust side copies them", () => {
  expect(assetFile(`0123456789abcdef${"f".repeat(48)}.webp`)).toBe("0123456789abcdef.webp");
  expect(assetFile("e".repeat(64))).toBe("eeeeeeeeeeeeeeee");
});
