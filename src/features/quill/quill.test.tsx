// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { clearMocks, mockConvertFileSrc, mockIPC } from "@tauri-apps/api/mocks";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createAppRouter } from "@/app/router";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { AppSettings, NewStory, Story, StoryOutline, WorldInfo } from "@/lib/bindings";
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
  calendar: { eras: [], months: Array.from({ length: 12 }, () => ({ name: "", days: 30 })) },
  storageLimit: null,
  schemaVersion: 18,
  createdAt: "2026-10-10T10:00:00Z",
  lastOpenedAt: "2026-10-10T10:00:00Z",
};

const SETTINGS: AppSettings = {
  preferences: {
    language: "fr",
    theme: "system",
    transparencyEffects: true,
    radioVolume: 70,
    radioMode: "loop",
    worldRail: false,
  },
  recentWorlds: [],
  defaultWorldsDir: null,
};

function story(id: string, title: string): Story {
  return {
    id,
    title,
    bookStyle: { color: "#2f4b6e", finish: "cloth" },
    cover: { assetId: null, titlePosition: "middle" },
    chapterCount: 2,
    wordCount: 1200,
    createdAt: "2026-10-10T10:00:00Z",
    updatedAt: "2026-10-10T10:00:00Z",
  };
}

function outline(of: Story): StoryOutline {
  return {
    story: of,
    chapters: [
      {
        id: `${of.id}-c1`,
        storyId: of.id,
        title: "Chapitre 1",
        currentDraftId: "d1",
        headerAssetId: null,
        wordCount: 0,
        drafts: [
          { id: "d1", name: "Brouillon 1", wordCount: 0, updatedAt: "" },
          ...(secondDraft ? [{ id: "d2", name: "Brouillon 2", wordCount: 5, updatedAt: "" }] : []),
        ],
      },
    ],
  };
}

/** Whether chapter 1 has a second draft ("Il neigeait sur la vallée"). */
let secondDraft = false;
let madeCurrent: string[] = [];

let stories: Story[];
let created: NewStory[];
let deleted: string[];
let saved: { id: string; content: string }[];
let renamed: { id: string; title: string }[];

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mockConvertFileSrc("windows");
  stories = [story("s1", "La Chute d'Eldefleur")];
  created = [];
  deleted = [];
  saved = [];
  renamed = [];
  secondDraft = false;
  madeCurrent = [];
  mockIPC((command, payload) => {
    const args = payload as Record<string, unknown>;
    switch (command) {
      case "current_world":
        return WORLD;
      case "get_settings":
        return SETTINGS;
      case "list_stories":
        return stories;
      case "story_outline": {
        const found = stories.find((s) => s.id === args.id);
        return found ? outline(found) : null;
      }
      case "create_story": {
        const input = args.story as NewStory;
        created.push(input);
        const made = {
          ...story("s2", input.title),
          bookStyle: input.bookStyle,
          cover: input.cover,
        };
        stories = [...stories, made];
        return outline(made);
      }
      case "delete_story":
        deleted.push(args.id as string);
        stories = stories.filter((s) => s.id !== args.id);
        return null;
      case "list_assets":
        return [];
      case "get_draft":
        return {
          id: args.id,
          chapterId: "s1-c1",
          name: args.id === "d2" ? "Brouillon 2" : "Brouillon 1",
          content: JSON.stringify({
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: args.id === "d2" ? "Il neigeait sur la vallée" : "Il était une fois",
                  },
                ],
              },
            ],
          }),
          wordCount: args.id === "d2" ? 5 : 4,
          updatedAt: "",
        };
      case "writing_panel":
        return "{}";
      case "story_notes":
        return [];
      case "set_current_draft":
        madeCurrent.push(args.id as string);
        return null;
      case "save_draft":
        saved.push(args as { id: string; content: string });
        return { id: args.id, name: "Brouillon 1", wordCount: 6, updatedAt: "" };
      case "create_chapter": {
        created.push(args as never);
        return {
          id: "s1-c2",
          storyId: "s1",
          title: args.title,
          currentDraftId: "d2",
          headerAssetId: null,
          wordCount: 0,
          drafts: [{ id: "d2", name: "Brouillon 1", wordCount: 0, updatedAt: "" }],
        };
      }
      case "rename_chapter":
        renamed.push(args as { id: string; title: string });
        return null;
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

test("the Quill tab lists the stories with their counts", async () => {
  await renderAt("/world/demo/quill");
  const list = await screen.findByRole("list", { name: "Histoires" });
  const link = within(list).getByRole("link", { name: /La Chute d'Eldefleur/ });
  expect(link.textContent).toContain("2 chapitres · 1200 mots");
  expect(link.getAttribute("href")).toBe("/world/demo/quill/story/s1");
});

test("a new story is set up, created, and opens on its first chapter", async () => {
  const router = await renderAt("/world/demo/quill");
  fireEvent.click(await screen.findByRole("link", { name: "Nouvelle histoire" }));
  const title = await screen.findByRole("textbox", { name: "Titre" });
  const create = screen.getByRole("button", { name: "Créer l'histoire" });
  expect(create.hasAttribute("disabled")).toBe(true);

  fireEvent.change(title, { target: { value: "  Les Gardiens  " } });
  fireEvent.click(screen.getByRole("button", { name: "Couleur #7a2e2e" }));
  fireEvent.click(screen.getByRole("radio", { name: "Cuir" }));
  fireEvent.click(screen.getByRole("radio", { name: "En haut" }));
  fireEvent.click(create);

  await waitFor(() => expect(created).toHaveLength(1));
  expect(created[0]).toEqual({
    title: "Les Gardiens",
    bookStyle: { color: "#7a2e2e", finish: "leather" },
    cover: { assetId: null, titlePosition: "top" },
    chapterTitle: "Chapitre 1",
    draftName: "Brouillon 1",
  });
  await waitFor(() =>
    expect(router.state.location.pathname).toBe("/world/demo/quill/story/s2/chapter/s2-c1"),
  );
  expect(
    ((await screen.findByRole("textbox", { name: "Titre du chapitre" })) as HTMLInputElement).value,
  ).toBe("Chapitre 1");
});

test("a story opens on its first chapter", async () => {
  const router = await renderAt("/world/demo/quill/story/s1");
  await waitFor(() =>
    expect(router.state.location.pathname).toBe("/world/demo/quill/story/s1/chapter/s1-c1"),
  );
});

test("deleting a story asks first", async () => {
  await renderAt("/world/demo/quill");
  await act(async () => {
    fireEvent.pointerDown(
      await screen.findByRole("button", { name: "Actions de l'histoire La Chute d'Eldefleur" }),
      { button: 0 },
    );
  });
  fireEvent.click(await screen.findByRole("menuitem", { name: "Supprimer l'histoire" }));
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByText(/2 chapitre\(s\), 1200 mots/)).toBeTruthy();
  fireEvent.click(within(dialog).getByRole("button", { name: "Supprimer définitivement" }));
  await waitFor(() => expect(deleted).toEqual(["s1"]));
  expect(await screen.findByText("Aucune histoire pour l'instant")).toBeTruthy();
});

test("the writing space saves the text, counts the words and manages chapters", async () => {
  const router = await renderAt("/world/demo/quill/story/s1/chapter/s1-c1");
  const text = await screen.findByRole("textbox", { name: "Texte du chapitre" });
  await waitFor(() => expect(text.textContent).toBe("Il était une fois"));
  expect(screen.getByText("4 mots dans ce chapitre · 1204 dans l'histoire")).toBeTruthy();

  // Typed text: counted at once, saved half a second later.
  const editor = (text as HTMLElement & { editor: import("@tiptap/react").Editor }).editor;
  act(() => {
    editor.commands.insertContentAt(editor.state.doc.content.size - 1, " deux mondes");
  });
  expect(screen.getByText("6 mots dans ce chapitre · 1206 dans l'histoire")).toBeTruthy();
  await waitFor(() => expect(saved).toHaveLength(1));
  expect(saved[0]?.id).toBe("d1");
  expect(JSON.parse(saved[0]?.content ?? "{}").content[0].content[0].text).toBe(
    "Il était une fois deux mondes",
  );

  // The title, written in place.
  const title = screen.getByRole("textbox", { name: "Titre du chapitre" });
  fireEvent.change(title, { target: { value: "Le départ" } });
  fireEvent.blur(title);
  await waitFor(() => expect(renamed).toEqual([{ id: "s1-c1", title: "Le départ" }]));

  // A new chapter opens.
  fireEvent.click(screen.getByRole("button", { name: "Nouveau chapitre" }));
  await waitFor(() =>
    expect(router.state.location.pathname).toBe("/world/demo/quill/story/s1/chapter/s1-c2"),
  );
});

test("another draft opens with a note, becomes current, and two drafts compare", async () => {
  secondDraft = true;
  const router = await renderAt("/world/demo/quill/story/s1/chapter/s1-c1");
  const drafts = await screen.findByRole("list", { name: "Brouillons de Chapitre 1" });
  expect(
    within(drafts).getByRole("link", { name: "Brouillon 1, version courante, 0 mot" }),
  ).toBeTruthy();

  fireEvent.click(within(drafts).getByRole("link", { name: "Brouillon 2, 5 mots" }));
  await waitFor(() =>
    expect(router.state.location.pathname).toBe(
      "/world/demo/quill/story/s1/chapter/s1-c1/draft/d2",
    ),
  );
  const note = await screen.findByRole("note");
  expect(note.textContent).toContain("« Brouillon 2 », qui n'est pas la version courante");
  expect(await screen.findByText("5 mots dans ce brouillon · 1200 dans l'histoire")).toBeTruthy();
  fireEvent.click(within(note).getByRole("button", { name: "En faire la version courante" }));
  await waitFor(() => expect(madeCurrent).toEqual(["d2"]));

  fireEvent.click(screen.getByRole("link", { name: "Comparer" }));
  await waitFor(() =>
    expect(router.state.location.pathname).toBe(
      "/world/demo/quill/story/s1/chapter/s1-c1/compare/d1/d2",
    ),
  );
  const table = await screen.findByRole("table");
  await waitFor(() => expect(table.querySelector("del")?.textContent).toContain("était une fois"));
  expect(table.querySelector("ins")?.textContent).toContain("neigeait sur la vallée");
});
