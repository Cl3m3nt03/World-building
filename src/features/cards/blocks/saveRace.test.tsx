// @vitest-environment jsdom
import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { createQueryClient } from "@/lib/query";
import { BlockEditor } from "./BlockEditor";
import { type Block, parseContent } from "./model";
import { cardContentKey } from "./useCardContent";

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
let held: (() => void)[];
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
      const write = () => {
        if (failSaves) throw new Error("disk full");
        stored = content;
        saved.push(content);
        return null;
      };
      if (!holdSaves) return write();
      return new Promise((resolve, reject) => {
        held.push(() => {
          try {
            resolve(write());
          } catch (error) {
            reject(error);
          }
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
    for (const release of held.splice(0)) release();
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
