// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { clearMocks, mockConvertFileSrc, mockIPC } from "@tauri-apps/api/mocks";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createAppRouter } from "@/app/router";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Card, DocumentTree, RelationTree, VariantContent, WorldInfo } from "@/lib/bindings";
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
    name: "Nouveau document (map, graph, arbre…)",
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
