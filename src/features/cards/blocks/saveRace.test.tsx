// @vitest-environment jsdom
import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { act, cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { createQueryClient } from "@/lib/query";
import { BlockEditor } from "./BlockEditor";
import { type Block, parseContent } from "./model";
import { cardContentKey, useSaveCardContent } from "./useCardContent";

/**
 * #586: the editor left saves on its way out, and the next editor of the
 * same card (World ↔ Wiki) starts at once, before that save is done.
 */

const START: Block[] = [
  { id: "t1", type: "text", doc: { type: "doc", content: [{ type: "paragraph" }] } },
];

/** What the Rust side holds, and the saves still on their way. */
let stored: string;
let saved: string[];
/** A save held on its way: `settle(true)` makes it fail. */
type Held = { content: string; settle: (fail: boolean) => void };
let held: Held[];
let holdSaves: boolean;
let failSaves: boolean;
let loads: number;

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  stored = JSON.stringify(START);
  saved = [];
  held = [];
  holdSaves = true;
  failSaves = false;
  loads = 0;
  mockIPC((command, payload) => {
    if (command === "get_card_content") {
      loads += 1;
      return stored;
    }
    if (command === "set_card_content") {
      const content = (payload as { content: string }).content;
      const write = (fail: boolean) => {
        if (fail) throw new Error("disk full");
        stored = content;
        saved.push(content);
        return null;
      };
      if (!holdSaves) return write(failSaves);
      return new Promise((resolve, reject) => {
        held.push({
          content,
          settle: (fail) => {
            try {
              resolve(write(fail));
            } catch (error) {
              reject(error);
            }
          },
        });
      });
    }
    return null;
  });
});

afterEach(async () => {
  cleanup();
  // No save is left on its way: the next test would wait for it.
  holdSaves = false;
  await releaseSaves();
  await waitFor(() => expect(held).toHaveLength(0));
  clearMocks();
  vi.restoreAllMocks();
});

/** Lets the saves on their way reach the Rust side. */
async function releaseSaves() {
  await act(async () => {
    for (const save of held.splice(0)) save.settle(failSaves);
  });
}

function editorView(client: QueryClient, key: string) {
  return (
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <BlockEditor key={key} cardId="aragorn" />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

async function firstText(): Promise<{ dom: HTMLElement; editor: Editor }> {
  const dom = await screen.findByRole("textbox", { name: "Bloc de texte 1" });
  return { dom, editor: (dom as HTMLElement & { editor: Editor }).editor };
}

const textOf = (content: string) => JSON.stringify(parseContent(content));

test("a card's next editor shows the text typed just before the previous one closed", async () => {
  const client = createQueryClient();
  const first = render(editorView(client, "world"));
  const { editor } = await firstText();
  act(() => {
    editor.commands.insertContent("Né au Gondor");
  });

  // Left at once: the save starts on the way out and is still on its way.
  first.unmount();
  await waitFor(() => expect(held).toHaveLength(1));

  render(editorView(client, "wiki"));
  const next = await firstText();
  expect(next.dom.textContent).toBe("Né au Gondor");

  // Typing there keeps the text typed before.
  act(() => {
    next.editor.commands.insertContentAt(next.editor.state.doc.content.size - 1, ", roi");
  });
  await releaseSaves();
  await waitFor(() => expect(held).toHaveLength(1));
  await releaseSaves();
  expect(textOf(stored)).toContain("Né au Gondor, roi");
  expect(saved.every((content) => textOf(content).includes("Né au Gondor"))).toBe(true);
});

test("the editor that replaces another in the same change of page starts from its last edits", async () => {
  const client = createQueryClient();
  // One render swaps the editors, as a change of route does.
  const view = render(editorView(client, "world"));
  const { editor } = await firstText();
  act(() => {
    editor.commands.insertContent("Né au Gondor");
  });

  view.rerender(editorView(client, "wiki"));
  const next = await firstText();
  expect(next.dom.textContent).toBe("Né au Gondor");

  act(() => {
    next.editor.commands.insertContentAt(next.editor.state.doc.content.size - 1, ", roi");
  });
  await releaseSaves();
  await waitFor(() => expect(held).toHaveLength(1));
  await releaseSaves();
  expect(textOf(stored)).toContain("Né au Gondor, roi");
});

test("a load sent while a save is on its way reads the text it saves", async () => {
  const client = createQueryClient();
  const first = render(editorView(client, "world"));
  const { editor } = await firstText();
  act(() => {
    editor.commands.insertContent("Né au Gondor");
  });
  first.unmount();
  const before = loads;

  // A rename, say, reloads the card's content while the save is held.
  const reload = client.refetchQueries({ queryKey: cardContentKey("aragorn") });
  await act(async () => {
    await Promise.resolve();
  });
  expect(loads).toBe(before);
  await releaseSaves();
  await reload;

  expect(loads).toBe(before + 1);
  expect(textOf(JSON.stringify(client.getQueryData(cardContentKey("aragorn"))))).toContain(
    "Né au Gondor",
  );
});

test("a failed save puts back the blocks it replaced in the cache", async () => {
  const client = createQueryClient();
  failSaves = true;
  const first = render(editorView(client, "world"));
  const { editor } = await firstText();
  act(() => {
    editor.commands.insertContent("Né au Gondor");
  });
  first.unmount();
  expect(textOf(JSON.stringify(client.getQueryData(cardContentKey("aragorn"))))).toContain(
    "Né au Gondor",
  );

  await waitFor(() => expect(held).toHaveLength(1));
  await releaseSaves();
  await waitFor(() =>
    expect(client.getQueryData(cardContentKey("aragorn"))).toEqual(parseContent(stored)),
  );
  expect(textOf(stored)).not.toContain("Né au Gondor");
});

// The saves themselves, as the editors send them (review of #602).

const KEY = cardContentKey("aragorn");
const text = (words: string): Block[] => [
  {
    id: "t1",
    type: "text",
    doc: {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: words }] }],
    },
  },
];

/** A client whose cache holds the card as loaded, and the card's save. */
function saver() {
  const client = createQueryClient();
  client.setQueryData(KEY, parseContent(stored));
  const hook = renderHook(() => useSaveCardContent("aragorn"), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
  const save = (blocks: Block[]) => hook.result.current.save(blocks).catch(() => undefined);
  return { client, save };
}

/** Settles the save held first; the next one queued behind it is then sent. */
async function settleFirst(fail: boolean) {
  await waitFor(() => expect(held.length).toBeGreaterThan(0));
  await act(async () => {
    held.shift()?.settle(fail);
  });
}

test("a failed save keeps a later save's blocks in the cache", async () => {
  const { client, save } = saver();
  const a = save(text("A"));
  void save(text("B"));

  await settleFirst(true);
  await a;

  // B is still on its way: the cache holds it, not the blocks before A.
  expect(client.getQueryData(KEY)).toEqual(text("B"));
  await settleFirst(false);
  expect(client.getQueryData(KEY)).toEqual(text("B"));
});

test("a failed save then the same blocks saved: the cache holds what the card has", async () => {
  // A letter typed then removed: two saves of equal blocks.
  const { client, save } = saver();
  void save(text("Né au Gondor"));
  const b = save(text("Né au Gondor"));

  await settleFirst(true);
  await settleFirst(false);
  await b;

  expect(textOf(stored)).toContain("Né au Gondor");
  expect(client.getQueryData(KEY)).toEqual(parseContent(stored));
});

test("two failed saves in a row put back the blocks saved before them", async () => {
  const { client, save } = saver();
  void save(text("A"));
  const b = save(text("B"));

  await settleFirst(true);
  await settleFirst(true);
  await b;

  expect(client.getQueryData(KEY)).toEqual(START);
});

test("the saves of a card reach it in the order they were sent", async () => {
  const { save } = saver();
  void save(text("A"));
  const b = save(text("B"));

  // Only A is on its way: B waits for it (were both sent, B could land first).
  await waitFor(() => expect(held).toHaveLength(1));
  await act(async () => {
    await Promise.resolve();
  });
  expect(held.map((one) => textOf(one.content))).toEqual([textOf(JSON.stringify(text("A")))]);
  await act(async () => {
    held.pop()?.settle(false);
  });
  await settleFirst(false);
  await b;
  expect(parseContent(stored)).toEqual(text("B"));
});
