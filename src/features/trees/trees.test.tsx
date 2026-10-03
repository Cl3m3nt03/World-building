// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { clearMocks, mockConvertFileSrc, mockIPC } from "@tauri-apps/api/mocks";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createAppRouter } from "@/app/router";
import { TooltipProvider } from "@/components/ui/tooltip";
import type {
  Card,
  DocumentTree,
  KnownRelation,
  RelationTree,
  RelationType,
  VariantContent,
  WorldInfo,
} from "@/lib/bindings";
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
  schemaVersion: 12,
  createdAt: "2026-10-03T10:00:00Z",
  lastOpenedAt: "2026-10-03T10:00:00Z",
} satisfies WorldInfo;

const ARAGORN = {
  id: "aragorn",
  title: "Aragorn",
  aliases: ["Grands-Pas"],
  typeId: null,
  imageAssetId: null,
} as unknown as Card;

/** The nodes saved for the first variant. */
const savedNodes = () => stored?.variants[0]?.content.nodes ?? [];

function relation(
  id: string,
  builtin: string | null,
  category: RelationType["category"],
  name = "",
): RelationType {
  return { id, builtin, name, icon: "heart", inverseId: null, category };
}

let relationTypes: RelationType[];
let known: KnownRelation[];
let calls: { command: string; payload: unknown }[];
let tree: DocumentTree;
let stored: RelationTree | null;

function emptyTree(title: string, variantName: string): RelationTree {
  return {
    id: "t1",
    title,
    variants: [
      {
        id: "v1",
        name: variantName,
        content: {
          nodes: [{ id: "n1", cardId: null, label: "", x: 0, y: 0 }],
          edges: [],
          annotations: [],
        },
      },
    ],
  };
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mockConvertFileSrc("windows");
  calls = [];
  stored = null;
  known = [];
  relationTypes = [
    relation("rel-parent", "parent", "family"),
    relation("rel-child", "child", "family"),
    relation("rel-partner", "partner", "couple"),
    relation("rel-mentor", null, "custom", "Mentor"),
  ];
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
      case "create_tree": {
        const { title, variantName } = payload as { title: string; variantName: string };
        stored = emptyTree(title, variantName);
        tree = {
          folders: [],
          documents: [
            {
              id: "t1",
              kind: "tree",
              title,
              folderId: null,
              parentId: null,
              sortOrder: 0,
              pinnedOrder: null,
              createdAt: "2026-10-03T10:00:00Z",
              typeId: null,
              imageAssetId: null,
            },
          ],
        };
        return stored;
      }
      case "get_tree":
        return stored;
      case "save_tree_variant": {
        const { variantId, content } = payload as { variantId: string; content: VariantContent };
        if (stored) {
          stored = {
            ...stored,
            variants: stored.variants.map((variant) =>
              variant.id === variantId ? { ...variant, content } : variant,
            ),
          };
        }
        return null;
      }
      case "list_cards":
        return [ARAGORN];
      case "list_card_types":
        return [];
      case "add_tree_variant": {
        const { copyOf, name } = payload as { copyOf: string; name: string };
        if (!stored) return null;
        const source = stored.variants.find((variant) => variant.id === copyOf);
        const copy = {
          id: `v${stored.variants.length + 1}`,
          name,
          content: {
            ...(source?.content ?? { nodes: [], edges: [], annotations: [] }),
            nodes: (source?.content.nodes ?? []).map((node) => ({
              ...node,
              id: `${node.id}-copy`,
            })),
          },
        };
        const index = stored.variants.findIndex((variant) => variant.id === copyOf);
        const variants = [...stored.variants];
        variants.splice(index + 1, 0, copy);
        stored = { ...stored, variants };
        return stored;
      }
      case "update_relation_type": {
        const { id, input } = payload as {
          id: string;
          input: RelationType & { symmetric: boolean };
        };
        relationTypes = relationTypes.map((type) =>
          type.id === id
            ? {
                ...type,
                name: input.name,
                icon: input.icon,
                category: input.category,
                inverseId: input.symmetric ? id : input.inverseId,
              }
            : type,
        );
        return relationTypes.find((type) => type.id === id);
      }
      case "relation_type_uses":
        return 1;
      case "delete_relation_type": {
        const { id } = payload as { id: string };
        relationTypes = relationTypes.filter((type) => type.id !== id);
        return null;
      }
      case "list_relation_types":
        return relationTypes;
      case "known_relations":
        return known;
      case "create_relation_type": {
        const { input } = payload as { input: { name: string; icon: string } };
        const created = relation("rel-new", null, "custom", input.name);
        relationTypes = [...relationTypes, created];
        return created;
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

test('"New tree" in the sidebar creates a tree with one empty character, and opens it', async () => {
  const router = await renderAt("/world/demo/world");

  const trigger = await screen.findByRole("button", {
    name: "Nouveau document (map, graph, arbre, canvas…)",
  });
  await act(async () => {
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
  });
  fireEvent.click(await screen.findByRole("menuitem", { name: "Nouvel arbre" }));

  await waitFor(() => expect(router.state.location.pathname).toBe("/world/demo/world/tree/t1"));
  expect(calls).toContainEqual({
    command: "create_tree",
    payload: { title: "Arbre sans nom", variantName: "Variante 1" },
  });
  expect(await screen.findByRole("application", { name: "Arbre Arbre sans nom" })).toBeTruthy();
  expect(await screen.findByText("Nouveau personnage")).toBeTruthy();
  expect(await screen.findByRole("treeitem", { name: "Arbre sans nom" })).toBeTruthy();
  expect((screen.getByLabelText("Nom de l'arbre") as HTMLInputElement).value).toBe(
    "Arbre sans nom",
  );
});

test("the « Relation tree » tile of the empty workspace creates a tree too", async () => {
  const router = await renderAt("/world/demo/world");
  fireEvent.click(await screen.findByRole("button", { name: "Arbre de relations" }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/world/demo/world/tree/t1"));
});

test("a blank tree offers to start from the known relations, placed by generation", async () => {
  stored = emptyTree("Lignée", "Variante 1");
  known = [
    { from: "arathorn", to: "gilraen", relationTypeId: "rel-partner" },
    { from: "arathorn", to: "aragorn", relationTypeId: "rel-child" },
    { from: "gilraen", to: "aragorn", relationTypeId: "rel-child" },
  ];
  await renderAt("/world/demo/world/tree/t1");
  const offer = await screen.findByRole("region", { name: "Partir de ce que le monde sait ?" });
  expect(offer.textContent).toContain("3 cartes sont déjà reliées par 3 relations");

  fireEvent.click(screen.getByRole("button", { name: "Reprendre ces relations" }));

  await waitFor(() =>
    expect(
      savedNodes()
        .map((node) => node.cardId)
        .sort(),
    ).toEqual(["aragorn", "arathorn", "gilraen"]),
  );
  const edges = stored?.variants[0]?.content.edges ?? [];
  expect(edges).toHaveLength(2);
  expect(edges.some((edge) => edge.source.kind === "edge")).toBe(true);
  expect(screen.queryByRole("region", { name: "Partir de ce que le monde sait ?" })).toBeNull();
  // Everything is there: nothing more to add.
  expect(
    (
      screen.getByRole("button", {
        name: "L'arbre montre déjà toutes les relations connues",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
});

test("« Commencer vide » keeps the blank tree", async () => {
  stored = emptyTree("Lignée", "Variante 1");
  known = [{ from: "arathorn", to: "aragorn", relationTypeId: "rel-child" }];
  await renderAt("/world/demo/world/tree/t1");
  fireEvent.click(await screen.findByRole("button", { name: "Commencer vide" }));
  expect(screen.queryByRole("region", { name: "Partir de ce que le monde sait ?" })).toBeNull();
  expect(savedNodes()).toHaveLength(1);
  // Still offered from the bar.
  expect(
    screen.getByRole("button", { name: "Ajouter la relation connue qui manque (1)" }),
  ).toBeTruthy();
});

test("a node shows its card's name, or its plain name", async () => {
  stored = emptyTree("Lignée", "Variante 1");
  const content = stored.variants[0]?.content;
  if (content) {
    content.nodes = [
      { id: "n1", cardId: "aragorn", label: "", x: 0, y: 0 },
      { id: "n2", cardId: null, label: "Gilraen", x: 200, y: 0 },
    ];
  }
  await renderAt("/world/demo/world/tree/t1");
  expect(await screen.findByText("Aragorn")).toBeTruthy();
  expect(screen.getByText("Gilraen")).toBeTruthy();
  expect(screen.queryByText("Nouveau personnage")).toBeNull();
});

test("clicking the empty node fills it with a card found by an alias, or with a plain name", async () => {
  stored = emptyTree("Lignée", "Variante 1");
  await renderAt("/world/demo/world/tree/t1");

  fireEvent.click(await screen.findByText("Nouveau personnage"));
  const search = await screen.findByRole("combobox", { name: "Carte ou nom du nœud" });
  fireEvent.change(search, { target: { value: "grands" } });
  fireEvent.keyDown(search, { key: "Enter" });
  expect(await screen.findByText("Aragorn")).toBeTruthy();
  await waitFor(() => expect(savedNodes()[0]).toMatchObject({ cardId: "aragorn", label: "" }));

  // The selected node's bar replaces it with a plain name.
  fireEvent.click(screen.getByRole("button", { name: "Remplacer" }));
  const again = await screen.findByRole("combobox", { name: "Carte ou nom du nœud" });
  fireEvent.change(again, { target: { value: "Gilraen" } });
  fireEvent.click(await screen.findByRole("option", { name: "Utiliser le nom « Gilraen »" }));
  expect(await screen.findByText("Gilraen")).toBeTruthy();
  await waitFor(() => expect(savedNodes()[0]).toMatchObject({ cardId: null, label: "Gilraen" }));
});

test("« Ajouter un nœud » adds an empty node ready to fill; the bar deletes it", async () => {
  stored = emptyTree("Lignée", "Variante 1");
  await renderAt("/world/demo/world/tree/t1");
  await screen.findByText("Nouveau personnage");

  fireEvent.click(screen.getByRole("button", { name: "Ajouter un nœud" }));
  expect(await screen.findByRole("combobox", { name: "Carte ou nom du nœud" })).toBeTruthy();
  await waitFor(() => expect(screen.getAllByText("Nouveau personnage")).toHaveLength(2));
  await waitFor(() => expect(savedNodes()).toHaveLength(2));
  fireEvent.keyDown(screen.getByRole("combobox", { name: "Carte ou nom du nœud" }), {
    key: "Escape",
  });

  fireEvent.click(await screen.findByRole("button", { name: "Supprimer le nœud et ses liens" }));
  await waitFor(() => expect(screen.getAllByText("Nouveau personnage")).toHaveLength(1));
  await waitFor(() => expect(savedNodes()).toHaveLength(1));
});

test("a card's node opens the card from its bar and on double click", async () => {
  stored = emptyTree("Lignée", "Variante 1");
  const content = stored.variants[0]?.content;
  if (content) content.nodes = [{ id: "n1", cardId: "aragorn", label: "", x: 0, y: 0 }];
  const router = await renderAt("/world/demo/world/tree/t1");

  fireEvent.doubleClick(await screen.findByText("Aragorn"));
  await waitFor(() =>
    expect(router.state.location.pathname).toBe("/world/demo/world/card/aragorn"),
  );
});

test("a node whose card is gone says so", async () => {
  stored = emptyTree("Lignée", "Variante 1");
  const content = stored.variants[0]?.content;
  if (content) content.nodes = [{ id: "n1", cardId: "gone", label: "", x: 0, y: 0 }];
  await renderAt("/world/demo/world/tree/t1");
  expect(await screen.findByText("Carte introuvable")).toBeTruthy();
});

/** The saved content of the first variant. */
const savedContent = () => stored?.variants[0]?.content;

/** Opens the relation list of the « + » `side` of the selected node, and picks `entry`. */
async function plus(side: string, entry: string) {
  // Nodes stay hidden in jsdom (React Flow cannot measure them), and so
  // without an accessible name: their « + » are found by their title.
  const button = await screen.findByTitle(new RegExp(`^Ajouter une relation ${side}`));
  await act(async () => {
    button.focus();
    fireEvent.keyDown(button, { key: "Enter" });
  });
  fireEvent.click(await screen.findByRole("menuitem", { name: entry }));
}

test("a « + » adds an empty relative on its side, linked by the picked relation", async () => {
  stored = emptyTree("Lignée", "Variante 1");
  const content = stored.variants[0]?.content;
  if (content) content.nodes = [{ id: "n1", cardId: null, label: "Aragorn", x: 0, y: 0 }];
  await renderAt("/world/demo/world/tree/t1");
  fireEvent.click(await screen.findByText("Aragorn"));

  // The four « + » show around the selected node.
  for (const side of ["au-dessus de", "à droite de", "en dessous de", "à gauche de"]) {
    expect(await screen.findByTitle(`Ajouter une relation ${side} Aragorn`)).toBeTruthy();
  }
  await plus("au-dessus de", "Parent");
  // The new node is selected, its search open, and already linked.
  expect(await screen.findByRole("combobox", { name: "Carte ou nom du nœud" })).toBeTruthy();
  await waitFor(() => expect(savedContent()?.nodes).toHaveLength(2));
  const [aragorn, parent] = savedContent()?.nodes ?? [];
  expect((parent?.y ?? 0) < (aragorn?.y ?? 0)).toBe(true);
  expect(savedContent()?.edges).toEqual([
    {
      id: expect.any(String),
      source: { kind: "node", id: "n1" },
      target: parent?.id,
      relationTypeId: "rel-parent",
      lineStyle: "solid",
    },
  ]);
});

test("« Skip for now » links without a type; « Custom relation… » names a new one", async () => {
  stored = emptyTree("Lignée", "Variante 1");
  const content = stored.variants[0]?.content;
  if (content) content.nodes = [{ id: "n1", cardId: null, label: "Aragorn", x: 0, y: 0 }];
  await renderAt("/world/demo/world/tree/t1");
  fireEvent.click(await screen.findByText("Aragorn"));

  await plus("à droite de", "Passer pour l'instant");
  await waitFor(() => expect(savedContent()?.edges[0]?.relationTypeId).toBeNull());
  const [, right] = savedContent()?.nodes ?? [];
  expect((right?.x ?? 0) > 0).toBe(true);

  fireEvent.keyDown(screen.getByRole("combobox", { name: "Carte ou nom du nœud" }), {
    key: "Escape",
  });
  fireEvent.click(await screen.findByText("Aragorn"));
  await plus("à gauche de", "Relation personnalisée…");
  fireEvent.change(await screen.findByLabelText("Nom de la relation"), {
    target: { value: "Rival" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));
  await waitFor(() => expect(savedContent()?.edges).toHaveLength(2));
  expect(calls).toContainEqual({
    command: "create_relation_type",
    payload: {
      input: { name: "Rival", icon: "link", category: "other", inverseId: null, symmetric: false },
    },
  });
  expect(savedContent()?.edges[1]?.relationTypeId).toBe("rel-new");
});

test("the world's own relations are offered next to the provided ones", async () => {
  stored = emptyTree("Lignée", "Variante 1");
  await renderAt("/world/demo/world/tree/t1");
  fireEvent.click(await screen.findByText("Nouveau personnage"));
  fireEvent.keyDown(await screen.findByRole("combobox", { name: "Carte ou nom du nœud" }), {
    key: "Escape",
  });
  const button = await screen.findByRole("button", { name: "Ajouter une relation" });
  await act(async () => {
    button.focus();
    fireEvent.keyDown(button, { key: "Enter" });
  });
  const items = (await screen.findAllByRole("menuitem")).map((item) => item.textContent);
  expect(items).toEqual([
    "Parent",
    "Enfant",
    "Partenaire",
    "Mentor",
    "Relation personnalisée…",
    "Passer pour l'instant",
    "Gérer les relations…",
  ]);
  // From the bar, a parent goes above (no « + » was picked).
  fireEvent.click(screen.getByRole("menuitem", { name: "Parent" }));
  await waitFor(() => expect(savedContent()?.nodes).toHaveLength(2));
  expect((savedContent()?.nodes[1]?.y ?? 0) < 0).toBe(true);
});

test("the text tool writes a free text where the tree is clicked; the eraser removes it", async () => {
  stored = emptyTree("Lignée", "Variante 1");
  await renderAt("/world/demo/world/tree/t1");
  await screen.findByText("Nouveau personnage");

  fireEvent.click(screen.getByRole("button", { name: "Texte" }));
  expect(screen.getByRole("toolbar", { name: "Options du texte" })).toBeTruthy();
  const pane = document.querySelector(".react-flow__pane") as HTMLElement;
  fireEvent.pointerDown(pane, { button: 0, clientX: 40, clientY: 40 });
  const field = await screen.findByLabelText("Texte libre");
  fireEvent.change(field, { target: { value: "Minas Tirith" } });
  fireEvent.keyDown(field, { key: "Enter" });
  await waitFor(() =>
    expect(savedContent()?.annotations).toEqual([
      {
        kind: "text",
        id: expect.any(String),
        x: expect.any(Number),
        y: expect.any(Number),
        text: "Minas Tirith",
        color: "ink",
        size: 20,
      },
    ]),
  );

  // Draw › eraser, then a click on the text removes it.
  fireEvent.click(screen.getByRole("button", { name: "Dessin" }));
  fireEvent.click(screen.getByRole("button", { name: "Gomme" }));
  fireEvent.pointerDown(
    screen.getByRole("button", { name: "Texte « Minas Tirith »", hidden: true }),
    {
      button: 0,
    },
  );
  await waitFor(() => expect(savedContent()?.annotations).toEqual([]));
});

test("« Ajouter une variante » names a copy of the current one; each variant is edited on its own", async () => {
  stored = emptyTree("Lignée", "Tome 1");
  const content = stored.variants[0]?.content;
  if (content) content.nodes = [{ id: "n1", cardId: null, label: "Aragorn", x: 0, y: 0 }];
  await renderAt("/world/demo/world/tree/t1");
  await screen.findByText("Aragorn");
  // One variant: no tabs yet.
  expect(screen.queryByRole("tablist", { name: "Variantes de l'arbre" })).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Ajouter une variante" }));
  const name = await screen.findByLabelText("Nom de la nouvelle variante");
  fireEvent.change(name, { target: { value: "Après la guerre" } });
  fireEvent.keyDown(name, { key: "Enter" });

  const tab = await screen.findByRole("tab", { name: "Après la guerre" });
  await waitFor(() => expect(tab.getAttribute("aria-selected")).toBe("true"));
  expect(calls).toContainEqual({
    command: "add_tree_variant",
    payload: { copyOf: "v1", name: "Après la guerre" },
  });
  expect(
    screen.getByRole("application", { name: "Arbre Lignée, variante Après la guerre" }),
  ).toBeTruthy();

  // Back to « Tome 1 »: its own content.
  fireEvent.click(screen.getByRole("tab", { name: "Tome 1" }));
  await waitFor(() =>
    expect(screen.getByRole("tab", { name: "Tome 1" }).getAttribute("aria-selected")).toBe("true"),
  );
  expect(screen.getByRole("application", { name: "Arbre Lignée, variante Tome 1" })).toBeTruthy();
});

test("« Gérer les relations… » changes a relation of the world, and deleting one used leaves its links without a type", async () => {
  stored = emptyTree("Lignée", "Variante 1");
  const content = stored.variants[0]?.content;
  if (content) {
    content.nodes = [
      { id: "n1", cardId: null, label: "Gandalf", x: 0, y: 0 },
      { id: "n2", cardId: null, label: "Frodon", x: 300, y: 0 },
    ];
    content.edges = [
      {
        id: "e1",
        source: { kind: "node", id: "n1" },
        target: "n2",
        relationTypeId: "rel-mentor",
        lineStyle: "solid",
      },
    ];
  }
  await renderAt("/world/demo/world/tree/t1");
  fireEvent.click(await screen.findByText("Gandalf"));
  const button = await screen.findByRole("button", { name: "Ajouter une relation" });
  await act(async () => {
    button.focus();
    fireEvent.keyDown(button, { key: "Enter" });
  });
  fireEvent.click(await screen.findByRole("menuitem", { name: "Gérer les relations…" }));
  const dialog = await screen.findByRole("dialog", { name: "Relations du monde" });

  fireEvent.click(within(dialog).getByRole("button", { name: "Mentor" }));
  fireEvent.change(within(dialog).getByLabelText("Nom de la relation"), {
    target: { value: "Maître" },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Enregistrer" }));
  await waitFor(() =>
    expect(calls).toContainEqual({
      command: "update_relation_type",
      payload: {
        id: "rel-mentor",
        input: {
          name: "Maître",
          icon: "heart",
          category: "other",
          inverseId: null,
          symmetric: false,
        },
      },
    }),
  );

  fireEvent.click(await within(dialog).findByRole("button", { name: "Supprimer la relation" }));
  const confirm = await screen.findByRole("dialog", { name: "Supprimer la relation « Maître » ?" });
  expect(
    within(confirm).getByText("Elle est utilisée par 1 lien : il deviendra « sans type »."),
  ).toBeTruthy();
  fireEvent.click(within(confirm).getByRole("button", { name: "Supprimer la relation" }));
  await waitFor(() => expect(savedContent()?.edges[0]?.relationTypeId).toBeNull());
});

test("Ctrl+Z undoes and Ctrl+Y redoes the variant's changes; the buttons too", async () => {
  stored = emptyTree("Lignée", "Variante 1");
  await renderAt("/world/demo/world/tree/t1");
  await screen.findByText("Nouveau personnage");
  const undo = screen.getByRole("button", { name: "Annuler (Ctrl+Z)" });
  expect((undo as HTMLButtonElement).disabled).toBe(true);

  for (let i = 0; i < 2; i++) {
    fireEvent.click(screen.getByRole("button", { name: "Ajouter un nœud" }));
    fireEvent.keyDown(await screen.findByRole("combobox", { name: "Carte ou nom du nœud" }), {
      key: "Escape",
    });
  }
  await waitFor(() => expect(screen.getAllByText("Nouveau personnage")).toHaveLength(3));

  fireEvent.keyDown(document.body, { key: "z", ctrlKey: true });
  fireEvent.keyDown(document.body, { key: "z", ctrlKey: true });
  await waitFor(() => expect(screen.getAllByText("Nouveau personnage")).toHaveLength(1));
  await waitFor(() => expect(savedNodes()).toHaveLength(1));
  expect((undo as HTMLButtonElement).disabled).toBe(true);

  fireEvent.keyDown(document.body, { key: "y", ctrlKey: true });
  await waitFor(() => expect(screen.getAllByText("Nouveau personnage")).toHaveLength(2));
  fireEvent.click(screen.getByRole("button", { name: "Rétablir (Ctrl+Y)" }));
  await waitFor(() => expect(savedNodes()).toHaveLength(3));
});
