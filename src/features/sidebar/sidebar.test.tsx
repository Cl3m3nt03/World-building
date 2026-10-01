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

let tree: DocumentTree;
let calls: { command: string; args: Record<string, unknown> }[];

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mockConvertFileSrc("windows");
  tree = SAMPLE;
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
      case "delete_folder":
        return null;
      case "current_world":
        return WORLD;
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
