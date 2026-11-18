// @vitest-environment jsdom
import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { act, cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { createQueryClient } from "@/lib/query";
import { draftQuery } from "../hooks/useQuill";
import { ChapterEditor } from "./ChapterEditor";
import { useSaveDraft } from "./useSaveDraft";

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
/** A save held on its way: `settle(true)` makes it fail. */
let held: { content: string; settle: (fail: boolean) => void }[];
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
          held.push({
            content: args.content as string,
            settle: (fail) => {
              if (fail) {
                reject(new Error("disk full"));
                return;
              }
              stored = args.content as string;
              resolve({ id: args.id, name: "Brouillon 1", wordCount: 6, updatedAt: "" });
            },
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
    for (const save of held.splice(0)) save.settle(failSaves);
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

// The saves themselves, as the editor sends them (review of #602).

const KEY = draftQuery("d1").queryKey;
const cached = (client: QueryClient) => client.getQueryData<{ content: string }>(KEY)?.content;

/** A client whose cache holds the draft as loaded, and the draft's save. */
function saver() {
  failSaves = false;
  const client = createQueryClient();
  client.setQueryData(KEY, { id: "d1", chapterId: "c1", name: "Brouillon 1", content: stored });
  const hook = renderHook(() => useSaveDraft("s1", "d1"), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
  const save = (text: string) => hook.result.current.save(doc(text)).catch(() => undefined);
  return { client, save };
}

/** Settles the save held first; the next one queued behind it is then sent. */
async function settleFirst(fail: boolean) {
  await waitFor(() => expect(held.length).toBeGreaterThan(0));
  await act(async () => {
    held.shift()?.settle(fail);
  });
}

test("a failed draft save keeps a later save's text in the cache", async () => {
  const { client, save } = saver();
  const a = save("A");
  void save("B");

  await settleFirst(true);
  await a;

  expect(cached(client)).toBe(doc("B"));
  await settleFirst(false);
  expect(cached(client)).toBe(doc("B"));
});

test("a failed draft save then the same text saved: the cache holds what the draft has", async () => {
  const { client, save } = saver();
  void save("deux mondes");
  const b = save("deux mondes");

  await settleFirst(true);
  await settleFirst(false);
  await b;

  expect(stored).toBe(doc("deux mondes"));
  expect(cached(client)).toBe(stored);
});

test("two failed draft saves in a row put back the text saved before them", async () => {
  const { client, save } = saver();
  void save("A");
  const b = save("B");

  await settleFirst(true);
  await settleFirst(true);
  await b;

  expect(cached(client)).toBe(doc("Il était une fois"));
});

test("the saves of a draft reach it in the order they were sent", async () => {
  const { save } = saver();
  void save("A");
  const b = save("B");

  // Only A is on its way: B waits for it (were both sent, B could land first).
  await waitFor(() => expect(held).toHaveLength(1));
  await act(async () => {
    await Promise.resolve();
  });
  expect(held.map((one) => one.content)).toEqual([doc("A")]);
  await act(async () => {
    held.pop()?.settle(false);
  });
  await settleFirst(false);
  await b;
  expect(stored).toBe(doc("B"));
});
