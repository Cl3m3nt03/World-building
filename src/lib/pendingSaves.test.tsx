// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BlockEditor } from "@/features/cards/blocks/BlockEditor";
import { parseContent } from "@/features/cards/blocks/model";
import { flushPendingSaves, usePendingSave } from "./pendingSaves";
import { createQueryClient } from "./query";

afterEach(() => {
  cleanup();
  clearMocks();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

test("pending saves are sent and awaited while their component is mounted", async () => {
  const done: string[] = [];
  const hook = renderHook(() =>
    usePendingSave(() =>
      new Promise<void>((resolve) => setTimeout(resolve, 20)).then(() => {
        done.push("saved");
      }),
    ),
  );

  await flushPendingSaves();
  expect(done).toEqual(["saved"]);

  hook.unmount();
  await flushPendingSaves();
  expect(done).toEqual(["saved"]);
});

test("a stuck save never blocks closing for longer than the timeout", async () => {
  vi.useFakeTimers();
  renderHook(() => usePendingSave(() => new Promise(() => {})));
  renderHook(() =>
    usePendingSave(() => {
      throw new Error("broken editor");
    }),
  );

  const flushed = vi.fn();
  void flushPendingSaves(3000).then(flushed);
  await vi.advanceTimersByTimeAsync(2999);
  expect(flushed).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(flushed).toHaveBeenCalled();
});

let saved: string[];

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  saved = [];
  mockIPC((command, payload) => {
    if (command === "get_card_content") {
      return JSON.stringify([
        { id: "t1", type: "text", doc: { type: "doc", content: [{ type: "paragraph" }] } },
      ]);
    }
    if (command === "set_card_content") {
      saved.push((payload as { content: string }).content);
      return null;
    }
    return null;
  });
});

test("text typed just before closing is saved before the world closes", async () => {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <TooltipProvider>
        <BlockEditor cardId="aragorn" />
      </TooltipProvider>
    </QueryClientProvider>,
  );
  const dom = await screen.findByRole("textbox", { name: "Bloc de texte 1" });
  const editor = (dom as HTMLElement & { editor: Editor }).editor;

  act(() => {
    editor.commands.insertContent("Né au Gondor");
  });
  // Nothing sent yet: the save waits for the typing to stop.
  expect(saved).toEqual([]);

  await act(() => flushPendingSaves());

  expect(saved).toHaveLength(1);
  const [block] = parseContent(saved[0] ?? "[]");
  expect(JSON.stringify(block)).toContain("Né au Gondor");
});
