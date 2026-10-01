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
  Card,
  CardType,
  DocumentTree,
  Folder,
  SearchHit,
  SidebarState,
  TreeDocument,
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
  schemaVersion: 7,
  createdAt: "2026-10-01T10:00:00Z",
  lastOpenedAt: "2026-10-01T10:00:00Z",
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

function folder(id: string, sortOrder: number, parentId: string | null = null): Folder {
  return { id, parentId, name: id, icon: "folder", sortOrder };
}

function doc(
  id: string,
  sortOrder: number,
  place: { folderId?: string; parentId?: string } = {},
): TreeDocument {
  return {
    id,
    kind: "card",
    title: id,
    folderId: place.folderId ?? null,
    parentId: place.parentId ?? null,
    sortOrder,
    pinnedOrder: null,
    createdAt: "2026-10-01T10:00:00Z",
    typeId: "character",
    imageAssetId: null,
  };
}

// Root: Places (folder) > [Winterfell > [Crypt], North (folder) > [Wall]], then Arya.
const SAMPLE: DocumentTree = {
  folders: [folder("Places", 0), folder("North", 1, "Places")],
  documents: [
    doc("Winterfell", 0, { folderId: "Places" }),
    doc("Crypt", 0, { parentId: "Winterfell" }),
    doc("Wall", 0, { folderId: "North" }),
    doc("Arya", 1),
  ],
};

const SEARCH_HITS: SearchHit[] = [
  {
    id: "Arya",
    kind: "card",
    title: [{ text: "Arya", matched: true }],
    typeId: "character",
    imageAssetId: null,
    match: { kind: "name" },
  },
  {
    id: "Wall",
    kind: "card",
    title: [{ text: "Wall", matched: false }],
    typeId: "character",
    imageAssetId: null,
    match: {
      kind: "alias",
      alias: [
        { text: "Arya", matched: true },
        { text: "'s post", matched: false },
      ],
    },
  },
  {
    id: "Crypt",
    kind: "card",
    title: [{ text: "Crypt", matched: false }],
    typeId: "character",
    imageAssetId: null,
    match: {
      kind: "content",
      excerpt: [
        { text: "…where ", matched: false },
        { text: "Arya", matched: true },
        { text: " hid…", matched: false },
      ],
    },
  },
];

let tree: DocumentTree;
let sidebarState: SidebarState;
let calls: { command: string; args: Record<string, unknown> }[];

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mockConvertFileSrc("windows");
  tree = SAMPLE;
  sidebarState = {};
  calls = [];
  mockIPC((command, payload) => {
    const args = payload as { id: string } & Record<string, unknown>;
    calls.push({ command, args });
    switch (command) {
      case "create_folder": {
        const created = folder("New", tree.folders.length + tree.documents.length);
        created.parentId = (args.parentId as string | null) ?? null;
        created.name = args.name as string;
        tree = { ...tree, folders: [...tree.folders, created] };
        return created;
      }
      case "update_folder": {
        const patch = args.patch as { name?: string; icon?: string };
        tree = {
          ...tree,
          folders: tree.folders.map((f) => (f.id === args.id ? { ...f, ...patch } : f)),
        };
        return tree.folders.find((f) => f.id === args.id);
      }
      case "search_documents":
        return (args.query as string) === "" ? [] : SEARCH_HITS;
      case "delete_folder":
      case "move_document":
        return null;
      case "rename_document":
        tree = {
          ...tree,
          documents: tree.documents.map((d) =>
            d.id === args.id ? { ...d, title: args.title as string } : d,
          ),
        };
        return {};
      case "trash_document":
        tree = { ...tree, documents: tree.documents.filter((d) => d.id !== args.id) };
        return {};
      case "duplicate_card": {
        const original = tree.documents.find((d) => d.id === args.id);
        const copy = { ...(original as TreeDocument), id: "copy", title: args.title as string };
        tree = { ...tree, documents: [...tree.documents, copy] };
        return { id: "copy", title: copy.title };
      }
      case "set_document_pinned": {
        const count = tree.documents.filter((d) => d.pinnedOrder !== null).length;
        tree = {
          ...tree,
          documents: tree.documents.map((d) =>
            d.id === args.id ? { ...d, pinnedOrder: args.pinned ? count : null } : d,
          ),
        };
        return null;
      }
      case "current_world":
        return WORLD;
      case "get_sidebar_state":
        return sidebarState;
      case "set_sidebar_state":
        return args.sidebar;
      case "get_settings":
        return SETTINGS;
      case "list_card_types":
        return TYPES;
      case "document_tree":
        return tree;
      case "list_cards":
        return [];
      case "get_card":
        return {
          id: args.id,
          title: args.id,
          typeId: "character",
          imageAssetId: null,
          aliases: [],
          createdAt: "2026-10-01T10:00:00Z",
          updatedAt: "2026-10-01T10:00:00Z",
          trashedAt: null,
        } satisfies Card;
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

/** The rows in the page, as "name level position/siblings expanded". */
function rows() {
  return Array.from(document.querySelectorAll<HTMLElement>("[role=treeitem]")).map((item) =>
    [
      item.textContent,
      item.getAttribute("aria-level"),
      `${item.getAttribute("aria-posinset")}/${item.getAttribute("aria-setsize")}`,
      item.getAttribute("aria-expanded") ?? "-",
    ].join(" "),
  );
}

const item = (name: string) =>
  Array.from(document.querySelectorAll<HTMLElement>("[role=treeitem]")).find(
    (candidate) => candidate.textContent === name,
  ) as HTMLElement;

async function press(key: string) {
  await act(async () => {
    fireEvent.keyDown(document.activeElement as HTMLElement, { key });
  });
}

test("shows the root closed, with levels and positions", async () => {
  await renderAt("/world/demo/world");
  await screen.findByRole("tree", { name: "Documents du monde" });

  await waitFor(() => expect(rows()).toEqual(["Places 1 1/2 false", "Arya 1 2/2 -"]));
  // One tab stop: the first row.
  expect(item("Places").tabIndex).toBe(0);
  expect(item("Arya").tabIndex).toBe(-1);
});

test("the keyboard moves, opens and closes, and opens a document", async () => {
  const router = await renderAt("/world/demo/world");
  await waitFor(() => expect(item("Places")).toBeTruthy());
  await act(async () => item("Places").focus());

  await press("ArrowRight"); // opens Places
  expect(rows()).toEqual([
    "Places 1 1/2 true",
    "Winterfell 2 1/2 false",
    "North 2 2/2 false",
    "Arya 1 2/2 -",
  ]);
  await press("ArrowRight"); // to its first child
  expect(document.activeElement).toBe(item("Winterfell"));
  await press("ArrowRight"); // opens Winterfell
  await press("ArrowDown");
  expect(document.activeElement).toBe(item("Crypt"));
  expect(item("Crypt").getAttribute("aria-level")).toBe("3");
  await press("ArrowLeft"); // to its parent
  expect(document.activeElement).toBe(item("Winterfell"));
  await press("ArrowLeft"); // closes Winterfell
  expect(item("Crypt")).toBeUndefined();
  await press("End");
  expect(document.activeElement).toBe(item("Arya"));
  expect(item("Arya").tabIndex).toBe(0);
  await press("Home");
  expect(document.activeElement).toBe(item("Places"));
  await press("Enter"); // closes the folder
  expect(rows()).toEqual(["Places 1 1/2 false", "Arya 1 2/2 -"]);

  await press("ArrowDown");
  await press("Enter");
  await waitFor(() => expect(router.state.location.pathname).toBe("/world/demo/world/card/Arya"));
  expect(item("Arya").getAttribute("aria-selected")).toBe("true");
});

test("opening a document opens the folders around it", async () => {
  await renderAt("/world/demo/world/card/Wall");

  await waitFor(() =>
    expect(rows()).toEqual([
      "Places 1 1/2 true",
      "Winterfell 2 1/2 false",
      "North 2 2/2 true",
      "Wall 3 1/1 -",
      "Arya 1 2/2 -",
    ]),
  );
  expect(item("Wall").getAttribute("aria-selected")).toBe("true");
  expect(item("Wall").tabIndex).toBe(0);
});

test("a click on the chevron opens a document's children without opening it", async () => {
  const router = await renderAt("/world/demo/world/card/Winterfell");
  await waitFor(() => expect(item("Winterfell")).toBeTruthy());

  await act(async () => {
    fireEvent.click(item("Winterfell").querySelector("svg") as SVGElement);
  });
  expect(item("Crypt")).toBeTruthy();
  expect(router.state.location.pathname).toBe("/world/demo/world/card/Winterfell");
});

test("only the rows in view are in the page, and the keyboard reaches the last one", async () => {
  tree = {
    folders: [],
    documents: Array.from({ length: 5000 }, (_, index) => doc(`Card ${index}`, index)),
  };
  await renderAt("/world/demo/world");
  await waitFor(() => expect(item("Card 0")).toBeTruthy());

  // A 640 px viewport holds 20 rows of 32 px; a few more are kept around.
  expect(rows().length).toBeLessThan(40);
  expect(item("Card 0").getAttribute("aria-setsize")).toBe("5000");

  await act(async () => item("Card 0").focus());
  await press("End");
  await waitFor(() => expect(document.activeElement).toBe(item("Card 4999")));
  expect(item("Card 4999").getAttribute("aria-posinset")).toBe("5000");
});

test("an empty world says how to create a card", async () => {
  tree = { folders: [], documents: [] };
  await renderAt("/world/demo/world");

  expect(
    await screen.findByText(
      "Aucune carte pour l'instant. Clic droit ici ou « Nouvelle carte » pour en créer une.",
    ),
  ).toBeTruthy();
  expect(screen.queryByRole("tree")).toBeNull();
});

const callsOf = (command: string) => calls.filter((call) => call.command === command);

test("New folder creates one at the root and lets its name be typed at once", async () => {
  await renderAt("/world/demo/world");
  await waitFor(() => expect(item("Places")).toBeTruthy());

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Nouveau dossier" }));
  });
  expect(callsOf("create_folder")[0]?.args).toEqual({
    parentId: null,
    name: "Nouveau dossier",
    icon: "folder",
  });
  const input = (await screen.findByRole("textbox", {
    name: "Nom du dossier",
  })) as HTMLInputElement;
  await waitFor(() => expect(document.activeElement).toBe(input));
  expect(input.value).toBe("Nouveau dossier");

  fireEvent.change(input, { target: { value: "Personnages" } });
  await act(async () => {
    fireEvent.keyDown(input, { key: "Enter" });
  });
  await waitFor(() =>
    expect(callsOf("update_folder")[0]?.args).toEqual({
      id: "New",
      patch: { name: "Personnages" },
    }),
  );
  await waitFor(() => expect(item("Personnages")).toBeTruthy());
  expect(screen.queryByRole("textbox", { name: "Nom du dossier" })).toBeNull();
});

test("F2 renames a folder in place; Escape keeps its name and the focus", async () => {
  await renderAt("/world/demo/world");
  await waitFor(() => expect(item("Places")).toBeTruthy());
  await act(async () => item("Places").focus());

  await press("F2");
  const input = (await screen.findByRole("textbox", {
    name: "Nom du dossier",
  })) as HTMLInputElement;
  fireEvent.change(input, { target: { value: "Lieux" } });
  await act(async () => {
    fireEvent.keyDown(input, { key: "Escape" });
  });

  expect(callsOf("update_folder")).toHaveLength(0);
  await waitFor(() => expect(document.activeElement).toBe(item("Places")));
});

test("a folder's right click offers its own actions; elsewhere, card creation and New folder", async () => {
  await renderAt("/world/demo/world");
  await waitFor(() => expect(item("Places")).toBeTruthy());

  await act(async () => {
    fireEvent.contextMenu(item("Places"));
  });
  const names = () => screen.getAllByRole("menuitem").map((entry) => entry.textContent);
  expect(names()).toEqual([
    "Nouveau sous-dossier",
    "RenommerF2",
    "Changer l'icône…",
    "Supprimer le dossier…Suppr",
  ]);
  await act(async () => {
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
  });

  await act(async () => {
    fireEvent.contextMenu(item("Arya"));
  });
  // A document's own actions, then card creation in a submenu, then New folder.
  expect(names()).toEqual([
    "OuvrirEntrée",
    "RenommerF2",
    "Épingler",
    "Dupliquer",
    "Déplacer vers…",
    "Visible dans le wikiArrive avec M8",
    "Mettre à la corbeilleSuppr",
    "Nouvelle carte",
    "Nouveau dossier",
  ]);
  await act(async () => {
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
  });

  await act(async () => {
    fireEvent.contextMenu(screen.getByRole("tree"), { clientY: 600 });
  });
  expect(names()).toContain("Personnage");
  expect(names().at(-1)).toBe("Nouveau dossier");
});

test("Change icon saves the chosen icon", async () => {
  await renderAt("/world/demo/world");
  await waitFor(() => expect(item("Places")).toBeTruthy());
  await act(async () => {
    fireEvent.contextMenu(item("Places"));
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("menuitem", { name: "Changer l'icône…" }));
  });

  const dialog = await screen.findByRole("dialog", { name: "Icône de « Places »" });
  await act(async () => {
    fireEvent.click(within(dialog).getByRole("radio", { name: "castle" }));
  });
  await waitFor(() =>
    expect(callsOf("update_folder")[0]?.args).toEqual({ id: "Places", patch: { icon: "castle" } }),
  );
});

test("Delete on a folder asks what to do with its content", async () => {
  await renderAt("/world/demo/world");
  await waitFor(() => expect(item("Places")).toBeTruthy());
  await act(async () => item("Places").focus());

  await press("Delete");
  const dialog = await screen.findByRole("dialog", {
    name: "Supprimer le dossier « Places » ?",
  });
  expect(
    within(dialog).getByText("Il contient 2 éléments. Que faire de son contenu ?"),
  ).toBeTruthy();
  expect(
    within(dialog).getByText(
      "Ses 3 documents vont à la corbeille ; ses sous-dossiers sont supprimés.",
    ),
  ).toBeTruthy();

  await act(async () => {
    fireEvent.click(within(dialog).getByRole("button", { name: "Remonter le contenu" }));
  });
  await waitFor(() =>
    expect(callsOf("delete_folder")[0]?.args).toEqual({ id: "Places", mode: "lift" }),
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

const pinned = () =>
  within(screen.getByRole("region", { name: "Épinglés" }))
    .getAllByRole("link")
    .map((link) => link.textContent);

test("pinned documents show at the top, in their order; nothing while none is pinned", async () => {
  await renderAt("/world/demo/world");
  await waitFor(() => expect(item("Arya")).toBeTruthy());
  expect(screen.queryByRole("region", { name: "Épinglés" })).toBeNull();
  cleanup();

  tree = {
    ...SAMPLE,
    documents: SAMPLE.documents.map((d) =>
      d.id === "Arya" ? { ...d, pinnedOrder: 1 } : d.id === "Wall" ? { ...d, pinnedOrder: 0 } : d,
    ),
  };
  await renderAt("/world/demo/world");
  await waitFor(() => expect(pinned()).toEqual(["Wall", "Arya"]));
});

test("a document's right click pins it, a pin's right click unpins it", async () => {
  await renderAt("/world/demo/world");
  await waitFor(() => expect(item("Arya")).toBeTruthy());

  await act(async () => {
    fireEvent.contextMenu(item("Arya"));
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("menuitem", { name: "Épingler" }));
  });
  expect(callsOf("set_document_pinned")[0]?.args).toEqual({ id: "Arya", pinned: true });
  await waitFor(() => expect(pinned()).toEqual(["Arya"]));

  const tile = within(screen.getByRole("region", { name: "Épinglés" })).getByRole("link");
  await act(async () => {
    fireEvent.contextMenu(tile);
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("menuitem", { name: "Désépingler" }));
  });
  expect(callsOf("set_document_pinned")[1]?.args).toEqual({ id: "Arya", pinned: false });
  await waitFor(() => expect(screen.queryByRole("region", { name: "Épinglés" })).toBeNull());
});

test("Rename, Change icon and Delete from a folder's menu get the focus once the menu is closed", async () => {
  await renderAt("/world/demo/world");
  await waitFor(() => expect(item("Places")).toBeTruthy());
  const fromMenu = async (action: string) => {
    await act(async () => {
      fireEvent.contextMenu(item("Places"));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("menuitem", { name: action }));
    });
  };

  await fromMenu("RenommerF2");
  const input = await screen.findByRole("textbox", { name: "Nom du dossier" });
  await waitFor(() => expect(document.activeElement).toBe(input));
  await act(async () => {
    fireEvent.keyDown(input, { key: "Escape" });
  });

  await fromMenu("Changer l'icône…");
  const icons = await screen.findByRole("dialog", { name: "Icône de « Places »" });
  await waitFor(() => expect(icons.contains(document.activeElement)).toBe(true));
  await act(async () => {
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "Escape" });
  });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

  await fromMenu("Supprimer le dossier…Suppr");
  const remove = await screen.findByRole("dialog", { name: "Supprimer le dossier « Places » ?" });
  await waitFor(() => expect(remove.contains(document.activeElement)).toBe(true));
});

async function menuAction(row: string, action: string) {
  await act(async () => {
    fireEvent.contextMenu(item(row));
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("menuitem", { name: action }));
  });
}

test("F2 renames a document in place", async () => {
  await renderAt("/world/demo/world");
  await waitFor(() => expect(item("Arya")).toBeTruthy());
  await act(async () => item("Arya").focus());

  await press("F2");
  const input = (await screen.findByRole("textbox", {
    name: "Nom du document",
  })) as HTMLInputElement;
  expect(input.value).toBe("Arya");
  fireEvent.change(input, { target: { value: "Arya Stark" } });
  await act(async () => {
    fireEvent.keyDown(input, { key: "Enter" });
  });
  await waitFor(() =>
    expect(callsOf("rename_document")[0]?.args).toEqual({ id: "Arya", title: "Arya Stark" }),
  );
  await waitFor(() => expect(document.activeElement).toBe(item("Arya Stark")));
});

test("Delete puts a document in the trash and leaves the open card", async () => {
  const router = await renderAt("/world/demo/world/card/Arya");
  await waitFor(() => expect(item("Arya")).toBeTruthy());
  await act(async () => item("Arya").focus());

  await press("Delete");
  await waitFor(() => expect(callsOf("trash_document")[0]?.args).toEqual({ id: "Arya" }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/world/demo/world"));
  await waitFor(() => expect(item("Arya")).toBeUndefined());
});

test("Duplicate makes a copy named after the card", async () => {
  await renderAt("/world/demo/world");
  await waitFor(() => expect(item("Arya")).toBeTruthy());

  await menuAction("Arya", "Dupliquer");
  expect(callsOf("duplicate_card")[0]?.args).toEqual({ id: "Arya", title: "Arya (copie)" });
  await waitFor(() => expect(item("Arya (copie)")).toBeTruthy());
});

test("Move to… picks a destination with the keyboard, never the document itself", async () => {
  await renderAt("/world/demo/world");
  await waitFor(() => expect(item("Arya")).toBeTruthy());

  await menuAction("Arya", "Déplacer vers…");
  const dialog = await screen.findByRole("dialog", { name: "Déplacer « Arya »" });
  const options = () =>
    within(dialog)
      .getAllByRole("option")
      .map((o) => o.textContent);
  // The root is its place: not offered.
  expect(options()).toEqual([
    "Places",
    "Winterfellcomme enfant",
    "Cryptcomme enfant",
    "North",
    "Wallcomme enfant",
  ]);

  const filter = within(dialog).getByRole("combobox", { name: "Filtrer les destinations" });
  fireEvent.change(filter, { target: { value: "nor" } });
  expect(options()).toEqual(["NorthPlaces"]);
  await act(async () => {
    fireEvent.keyDown(filter, { key: "Enter" });
  });
  expect(callsOf("move_document")[0]?.args).toEqual({
    id: "Arya",
    place: { kind: "folder", id: "North" },
    index: 1,
  });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

test("Rename and Move to… from the menu get the focus once the menu is closed", async () => {
  await renderAt("/world/demo/world");
  await waitFor(() => expect(item("Arya")).toBeTruthy());

  await menuAction("Arya", "RenommerF2");
  const input = await screen.findByRole("textbox", { name: "Nom du document" });
  await waitFor(() => expect(document.activeElement).toBe(input));
  await act(async () => {
    fireEvent.keyDown(input, { key: "Escape" });
  });

  await menuAction("Places", "RenommerF2");
  const folderInput = await screen.findByRole("textbox", { name: "Nom du dossier" });
  await waitFor(() => expect(document.activeElement).toBe(folderInput));
  await act(async () => {
    fireEvent.keyDown(folderInput, { key: "Escape" });
  });

  await menuAction("Arya", "Déplacer vers…");
  const filter = await screen.findByRole("combobox", { name: "Filtrer les destinations" });
  await waitFor(() => expect(document.activeElement).toBe(filter));
});

const searchField = () => screen.getByRole("combobox", { name: "Rechercher dans le monde" });

test("typing searches: names first, then content with an excerpt; Enter opens, Escape clears", async () => {
  const router = await renderAt("/world/demo/world");
  await waitFor(() => expect(item("Places")).toBeTruthy());

  fireEvent.change(searchField(), { target: { value: "ary" } });
  const results = await screen.findByRole("listbox", { name: "Résultats de la recherche" });
  await waitFor(() => expect(within(results).getAllByRole("option")).toHaveLength(3));
  expect(screen.queryByRole("tree")).toBeNull();
  const groups = within(results)
    .getAllByRole("group")
    .map((g) => g.getAttribute("aria-label"));
  expect(groups).toEqual(["Noms", "Contenu"]);
  expect(
    within(results)
      .getAllByRole("option")
      .map((o) => o.textContent),
  ).toEqual(["Arya", "WallAlias : Arya's post", "Crypt…where Arya hid…"]);
  expect(results.querySelectorAll("mark")).toHaveLength(3);

  for (let i = 0; i < 2; i++) {
    await act(async () => {
      fireEvent.keyDown(searchField(), { key: "ArrowDown" });
    });
  }
  const options = within(results).getAllByRole("option");
  expect(searchField().getAttribute("aria-activedescendant")).toBe(options[2]?.id);
  await act(async () => {
    fireEvent.keyDown(searchField(), { key: "Enter" });
  });
  await waitFor(() => expect(router.state.location.pathname).toBe("/world/demo/world/card/Crypt"));

  await act(async () => {
    fireEvent.keyDown(searchField(), { key: "Escape" });
  });
  expect((searchField() as HTMLInputElement).value).toBe("");
  expect(await screen.findByRole("tree")).toBeTruthy();
});

test("Ctrl+K from another tab opens the World tab with the search field focused", async () => {
  const router = await renderAt("/world/demo/home");
  await act(async () => {
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
  });
  await waitFor(() => expect(router.state.location.pathname).toBe("/world/demo/world"));
  await waitFor(() => expect(document.activeElement).toBe(searchField()));
});

test("filters by card type and sorts by name; manual order comes back", async () => {
  const typedTypes: CardType[] = [
    TYPES[0] as CardType,
    { ...(TYPES[0] as CardType), id: "place", name: "Lieu", icon: "map-pin", color: "green" },
  ];
  mockIPC((command) => {
    if (command === "list_card_types") return typedTypes;
    if (command === "document_tree")
      return {
        folders: [folder("Places", 1)],
        documents: [
          { ...doc("Zed", 0), typeId: "character" },
          { ...doc("Winterfell", 0, { folderId: "Places" }), typeId: "place" },
          { ...doc("Arya", 1, { folderId: "Places" }), typeId: "character" },
          { ...doc("Bran", 2), typeId: "character" },
        ],
      };
    if (command === "current_world") return WORLD;
    if (command === "get_settings") return SETTINGS;
    if (command === "get_sidebar_state") return {};
    return undefined;
  });
  await renderAt("/world/demo/world");
  await waitFor(() =>
    expect(rows()).toEqual(["Zed 1 1/3 -", "Places 1 2/3 false", "Bran 1 3/3 -"]),
  );

  await openMenu(screen.getByRole("button", { name: "Filtres et tri" }));
  // Quick choices in a row (no re-render in between) all count.
  await act(async () => {
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Personnage" }));
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Lieu" }));
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Lieu" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Nom" }));
  });
  // The menu stays open while choices are made.
  expect(screen.getByRole("menu")).toBeTruthy();
  await act(async () => {
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "Escape" });
  });

  // Characters only, by name, folders first and open; Places only holds a match.
  await waitFor(() =>
    expect(rows()).toEqual(["Places 1 1/3 true", "Arya 2 1/1 -", "Bran 1 2/3 -", "Zed 1 3/3 -"]),
  );
  expect(item("Places").hasAttribute("data-context")).toBe(true);
  expect(screen.getByRole("button", { name: "Filtres et tri (actifs)" })).toBeTruthy();
  expect(screen.getByText("Trié par nom : le glisser-déposer ne réordonne pas.")).toBeTruthy();

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Ordre manuel" }));
  });
  await waitFor(() =>
    expect(rows()).toEqual(["Zed 1 1/3 -", "Places 1 2/3 true", "Arya 2 1/1 -", "Bran 1 3/3 -"]),
  );
});

/** Opens a Radix menu the keyboard way (Enter on its focused trigger). */
async function openMenu(trigger: HTMLElement) {
  await act(async () => {
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
  });
}

test("the sidebar opens as saved for the world, and remembers opened folders", async () => {
  sidebarState = { expanded: ["f:Places"], view: { sort: "name" } };
  await renderAt("/world/demo/world");

  // Saved: Places open, sorted by name (folders first).
  await waitFor(() =>
    expect(rows()).toEqual([
      "Places 1 1/2 true",
      "North 2 1/2 false",
      "Winterfell 2 2/2 false",
      "Arya 1 2/2 -",
    ]),
  );

  await act(async () => {
    fireEvent.click(item("North"));
  });
  await waitFor(
    () =>
      expect(callsOf("set_sidebar_state").at(-1)?.args.sidebar).toEqual({
        expanded: ["f:Places", "f:North"],
        view: { sort: "name" },
      }),
    { timeout: 2000 },
  );
});

test("a collapsed sidebar stays collapsed, with a button to bring it back", async () => {
  sidebarState = { collapsed: true };
  await renderAt("/world/demo/world");

  expect(await screen.findByRole("button", { name: "Déplier la barre latérale" })).toBeTruthy();
  expect(screen.queryByRole("complementary", { name: "Barre latérale" })).toBeNull();
});
