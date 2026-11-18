// @vitest-environment jsdom
import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { createQueryClient } from "@/lib/query";
import { draftQuery } from "../hooks/useQuill";
import { ChapterEditor } from "./ChapterEditor";

/**
 * #586, in Quill: the chapter's editor saves on its way out, and the next
 * editor of the same draft (a draft made current changes the page) starts
 * at once, before that save is done.
 */

const doc = (text: string) =>
  JSON.stringify({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  });

let stored: string;
let held: (() => void)[];
let failSaves: boolean;

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  stored = doc("Il était une fois");
  held = [];
  failSaves = false;
  mockIPC((command, payload) => {
    const args = payload as Record<string, unknown>;
    switch (command) {
      case "get_draft":
        return { id: args.id, chapterId: "c1", name: "Brouillon 1", content: stored, wordCount: 4 };
      case "save_draft":
        return new Promise((resolve, reject) => {
          held.push(() => {
            if (failSaves) {
              reject(new Error("disk full"));
              return;
            }
            stored = args.content as string;
            resolve({ id: args.id, name: "Brouillon 1", wordCount: 6, updatedAt: "" });
          });
        });
      case "story_notes":
      case "draft_cues":
      case "list_cards":
        return [];
      default:
        return null;
    }
  });
});

async function releaseSaves() {
  await act(async () => {
    for (const release of held.splice(0)) release();
  });
}

afterEach(async () => {
  cleanup();
  await waitFor(async () => {
    await releaseSaves();
    expect(held).toHaveLength(0);
  });
  clearMocks();
  vi.restoreAllMocks();
});

function view(client: QueryClient, key: string) {
  return (
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <ChapterEditor
          key={key}
          storyId="s1"
          draftId="d1"
          onWords={() => {}}
          onHeader={() => {}}
          onOpenCard={() => {}}
          focusNote={null}
        />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

async function chapterText(): Promise<{ dom: HTMLElement; editor: Editor }> {
  const dom = await screen.findByRole("textbox", { name: "Texte du chapitre" });
  return { dom, editor: (dom as HTMLElement & { editor: Editor }).editor };
}

const append = (editor: Editor, text: string) =>
  act(() => {
    editor.commands.insertContentAt(editor.state.doc.content.size - 1, text);
  });

test("the editor that replaces another of the same draft starts from its last words", async () => {
  const client = createQueryClient();
  const page = render(view(client, "draft-route"));
  const { editor } = await chapterText();
  await waitFor(() => expect(editor.getText()).toBe("Il était une fois"));
  append(editor, " deux mondes");

  // One render swaps the editors, as a change of route does; the save is held.
  page.rerender(view(client, "chapter-route"));
  await waitFor(() => expect(held).toHaveLength(1));
  const next = await chapterText();
  expect(next.dom.textContent).toBe("Il était une fois deux mondes");

  append(next.editor, " et un roi");
  await releaseSaves();
  await waitFor(() => expect(held).toHaveLength(1), { timeout: 2000 });
  await releaseSaves();
  expect(JSON.parse(stored).content[0].content[0].text).toBe(
    "Il était une fois deux mondes et un roi",
  );
});

test("a draft read while its save is on its way reads the saved text", async () => {
  const client = createQueryClient();
  const page = render(view(client, "write"));
  const { editor } = await chapterText();
  await waitFor(() => expect(editor.getText()).toBe("Il était une fois"));
  append(editor, " deux mondes");
  page.unmount();
  await waitFor(() => expect(held).toHaveLength(1));

  const read = client.fetchQuery({ ...draftQuery("d1"), staleTime: 0 });
  await releaseSaves();
  expect((await read).content).toContain("deux mondes");
});

test("a failed draft save puts back the text it replaced in the cache", async () => {
  const client = createQueryClient();
  failSaves = true;
  const page = render(view(client, "write"));
  const { editor } = await chapterText();
  await waitFor(() => expect(editor.getText()).toBe("Il était une fois"));
  append(editor, " deux mondes");
  page.unmount();
  expect(client.getQueryData<{ content: string }>(draftQuery("d1").queryKey)?.content).toContain(
    "deux mondes",
  );

  await waitFor(() => expect(held).toHaveLength(1));
  await releaseSaves();
  await waitFor(() =>
    expect(client.getQueryData<{ content: string }>(draftQuery("d1").queryKey)?.content).toBe(
      doc("Il était une fois"),
    ),
  );
});
