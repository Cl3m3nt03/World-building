// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { clearMocks, mockConvertFileSrc, mockIPC } from "@tauri-apps/api/mocks";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createAppRouter } from "@/app/router";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Canvas, DocumentTree, WorldInfo } from "@/lib/bindings";
import { createQueryClient } from "@/lib/query";

// Excalidraw draws on a real <canvas>, which jsdom does not have: the view is
// checked on the real app; here a stand-in shows what it was given.
vi.mock("./components/CanvasView", () => ({
  default: ({ label, canvas }: { label: string; canvas: Canvas }) => (
    <section aria-label={label}>{canvas.scene}</section>
  ),
}));

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

let calls: { command: string; payload: unknown }[];
let tree: DocumentTree;
let stored: Canvas | null;

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
      case "create_canvas": {
        const { title } = payload as { title: string };
        stored = { id: "c1", title, scene: '{"elements":[]}', appState: "{}" };
        tree = {
          folders: [],
          documents: [
            {
              id: "c1",
              kind: "canvas",
              title,
              folderId: null,
              parentId: null,
              sortOrder: 0,
              pinnedOrder: null,
              createdAt: "2026-10-03T10:00:00Z",
              typeId: null,
              imageAssetId: null,
              wikiVisible: false,
            },
          ],
        };
        return stored;
      }
      case "get_canvas":
        return stored;
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

test('"New canvas" in the sidebar creates an empty canvas and opens it', async () => {
  const router = await renderAt("/world/demo/world");
  const trigger = await screen.findByRole("button", {
    name: "Nouveau document (map, graph, arbre, canvas…)",
  });
  await act(async () => {
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
  });
  fireEvent.click(await screen.findByRole("menuitem", { name: "Nouveau canvas" }));

  await waitFor(() => expect(router.state.location.pathname).toBe("/world/demo/world/canvas/c1"));
  expect(calls).toContainEqual({ command: "create_canvas", payload: { title: "Canvas sans nom" } });
  const view = await screen.findByRole("region", { name: "Canvas Canvas sans nom" });
  expect(view.textContent).toBe('{"elements":[]}');
  expect(await screen.findByRole("treeitem", { name: "Canvas sans nom" })).toBeTruthy();
  expect((screen.getByLabelText("Nom du canvas") as HTMLInputElement).value).toBe(
    "Canvas sans nom",
  );
});

test("the « Canvas » tile of the empty workspace creates a canvas too", async () => {
  const router = await renderAt("/world/demo/world");
  fireEvent.click(await screen.findByRole("button", { name: "Canvas" }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/world/demo/world/canvas/c1"));
});
