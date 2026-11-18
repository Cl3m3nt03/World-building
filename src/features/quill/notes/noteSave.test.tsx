// @vitest-environment jsdom
import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { StoryNote } from "@/lib/bindings";
import { flushPendingSaves } from "@/lib/pendingSaves";
import { createQueryClient } from "@/lib/query";
import { ChapterEditor } from "../editor/ChapterEditor";
import { quillKeys } from "../hooks/useQuill";

/**
 * #609: a note typed in its popover is kept however the popover closes. A
 * closing popover takes its field away without a blur, so the note cannot
 * wait for the field to be left.
 */

const content = JSON.stringify({
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Il pleuvait sur " },
        { type: "text", text: "la ville", marks: [{ type: "note", attrs: { noteId: "n1" } }] },
      ],
    },
  ],
});

let stored: StoryNote;
let calls: { command: string; args: Record<string, unknown> }[];
/** Note saves held on their way, while `holdSaves` is set. */
let held: (() => void)[];
let holdSaves: boolean;

const callsOf = (command: string) => calls.filter((call) => call.command === command);

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  stored = {
    id: "n1",
    draftId: "d1",
    draftName: "Brouillon 1",
    chapterId: "c1",
    chapterTitle: "Chapitre 1",
    body: "",
    createdAt: "",
    updatedAt: "",
  };
  calls = [];
  held = [];
  holdSaves = false;
  mockIPC((command, payload) => {
    const args = payload as Record<string, unknown>;
    calls.push({ command, args });
    switch (command) {
      case "get_draft":
        return { id: args.id, chapterId: "c1", name: "Brouillon 1", content, wordCount: 5 };
      case "story_notes":
        return [stored];
      case "update_note": {
        const write = () => {
          stored = { ...stored, body: args.body as string, updatedAt: "now" };
        };
        if (!holdSaves) {
          write();
          return { ...stored };
        }
        return new Promise((resolve) => {
          held.push(() => {
            write();
            resolve({ ...stored });
          });
        });
      }
      case "delete_note":
        return null;
      case "draft_cues":
      case "list_cards":
        return [];
      default:
        return null;
    }
  });
});

afterEach(async () => {
  cleanup();
  await act(async () => {
    for (const release of held.splice(0)) release();
  });
  clearMocks();
  vi.restoreAllMocks();
});

function view(client: QueryClient) {
  return (
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <ChapterEditor
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

/** Opens the note from its icon in the margin, and returns its field. */
async function openNote(snippet = "Note vide") {
  fireEvent.click(await screen.findByRole("button", { name: `Note : ${snippet}` }));
  return screen.findByRole("textbox", { name: "Note" });
}

/** Faster than the save after a pause in the typing: the closing saved it. */
const RIGHT_AWAY = { timeout: 250 };

test("a note closed with Escape is saved, and reopens with its text", async () => {
  const client = createQueryClient();
  render(view(client));
  const field = await openNote();
  fireEvent.change(field, { target: { value: "Une idée pour la suite" } });
  fireEvent.keyDown(field, { key: "Escape" });

  await waitFor(() => expect(screen.queryByRole("textbox", { name: "Note" })).toBeNull());
  await waitFor(
    () =>
      expect(callsOf("update_note").map((call) => call.args)).toEqual([
        { id: "n1", body: "Une idée pour la suite" },
      ]),
    RIGHT_AWAY,
  );
  const reopened = await openNote("Une idée pour la suite");
  expect((reopened as HTMLTextAreaElement).value).toBe("Une idée pour la suite");
});

test("a note reopened while its save is on its way shows what was typed", async () => {
  const client = createQueryClient();
  holdSaves = true;
  render(view(client));
  const field = await openNote();
  fireEvent.change(field, { target: { value: "Encore en route" } });
  fireEvent.keyDown(field, { key: "Escape" });
  await waitFor(() => expect(held).toHaveLength(1), RIGHT_AWAY);

  const reopened = await openNote("Encore en route");
  expect((reopened as HTMLTextAreaElement).value).toBe("Encore en route");
  // The notes listed (left column, Home board) follow too.
  expect(client.getQueryData<StoryNote[]>(quillKeys.notes("s1"))?.[0]?.body).toBe(
    "Encore en route",
  );
});

test("a note closed with « Fermer » or a click outside is saved", async () => {
  const client = createQueryClient();
  render(view(client));
  let field = await openNote();
  fireEvent.change(field, { target: { value: "Premier jet" } });
  fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
  await waitFor(() => expect(callsOf("update_note")).toHaveLength(1), RIGHT_AWAY);

  field = await openNote("Premier jet");
  fireEvent.change(field, { target: { value: "Second jet" } });
  // A click outside (Radix listens once the popover is in place). No blur
  // is sent here: the closing alone must save.
  await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
  fireEvent.pointerDown(document.body, { button: 0 });
  fireEvent.click(document.body);
  await waitFor(() => expect(screen.queryByRole("textbox", { name: "Note" })).toBeNull());
  await waitFor(
    () => expect(callsOf("update_note").at(-1)?.args).toEqual({ id: "n1", body: "Second jet" }),
    RIGHT_AWAY,
  );
});

test("a note being typed is saved when the editor goes away, or the world closes", async () => {
  const client = createQueryClient();
  const page = render(view(client));
  const field = await openNote();
  fireEvent.change(field, { target: { value: "Avant de fermer" } });
  await act(() => flushPendingSaves());
  expect(callsOf("update_note").map((call) => call.args.body)).toEqual(["Avant de fermer"]);

  // Still open: typed on, then the editor goes (another tab, another page).
  fireEvent.change(field, { target: { value: "Avant de partir" } });
  page.unmount();
  await waitFor(
    () => expect(callsOf("update_note").at(-1)?.args.body).toBe("Avant de partir"),
    RIGHT_AWAY,
  );
});

test("a note is saved a moment after the typing pauses", async () => {
  const client = createQueryClient();
  render(view(client));
  const field = await openNote();
  fireEvent.change(field, { target: { value: "Sans fermer" } });
  await waitFor(() => expect(callsOf("update_note")).toHaveLength(1), { timeout: 2000 });
  expect(screen.getByRole("textbox", { name: "Note" })).toBeTruthy();
});

test("a deleted note is not saved again with what was typed", async () => {
  const client = createQueryClient();
  render(view(client));
  const field = await openNote();
  fireEvent.change(field, { target: { value: "À jeter" } });
  fireEvent.click(screen.getByRole("button", { name: "Supprimer la note" }));
  await waitFor(() => expect(callsOf("delete_note")).toHaveLength(1));
  await waitFor(() => expect(screen.queryByRole("textbox", { name: "Note" })).toBeNull());
  // Past the pause after the typing: still nothing sent.
  await new Promise((resolve) => setTimeout(resolve, 700));
  expect(callsOf("update_note")).toHaveLength(0);
});
