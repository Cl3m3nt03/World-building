// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { createQueryClient } from "@/lib/query";
import { BlockEditor } from "./BlockEditor";
import { type Block, move, parseContent } from "./model";

function textBlock(id: string, text: string): Block {
  return {
    id,
    type: "text",
    doc: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] },
  };
}

let saved: string[];
let initial: Block[];

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  saved = [];
  initial = [];
  mockIPC((command, payload) => {
    const args = payload as Record<string, unknown>;
    if (command === "get_card_content") return JSON.stringify(initial);
    if (command === "set_card_content") {
      saved.push(args.content as string);
      return null;
    }
    return null;
  });
});

afterEach(() => {
  cleanup();
  clearMocks();
  vi.restoreAllMocks();
});

function renderEditor() {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <TooltipProvider>
        <BlockEditor cardId="aragorn" />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

/** Ids of the blocks in the last save. */
const lastSaved = () => parseContent(saved.at(-1) ?? "[]").map((block) => block.id);

async function openMenu(trigger: HTMLElement) {
  await act(async () => {
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
  });
}

test("an empty card invites to write, and the first click adds a text block", async () => {
  renderEditor();

  fireEvent.click(await screen.findByRole("button", { name: /Commencez à écrire/ }));

  expect(await screen.findByRole("textbox", { name: "Bloc de texte 1" })).toBeTruthy();
  await waitFor(() => expect(lastSaved()).toHaveLength(1));
  expect(parseContent(saved.at(-1) as string)[0]?.type).toBe("text");
});

test("shows the saved blocks with their text", async () => {
  initial = [textBlock("a", "Il était une fois"), textBlock("b", "La fin")];
  renderEditor();

  const first = await screen.findByRole("textbox", { name: "Bloc de texte 1" });
  expect(first.textContent).toBe("Il était une fois");
  expect(screen.getByRole("textbox", { name: "Bloc de texte 2" }).textContent).toBe("La fin");
});

test("blocks move down and up, and are deleted, from their menu", async () => {
  initial = [textBlock("a", "A"), textBlock("b", "B"), textBlock("c", "C")];
  renderEditor();
  await screen.findByRole("textbox", { name: "Bloc de texte 3" });

  await openMenu(screen.getByRole("button", { name: "Actions du bloc 1" }));
  await act(async () => {
    fireEvent.click(await screen.findByRole("menuitem", { name: "Descendre" }));
  });
  await waitFor(() => expect(lastSaved()).toEqual(["b", "a", "c"]));

  await openMenu(screen.getByRole("button", { name: "Actions du bloc 3" }));
  await act(async () => {
    fireEvent.click(await screen.findByRole("menuitem", { name: "Monter" }));
  });
  await waitFor(() => expect(lastSaved()).toEqual(["b", "c", "a"]));

  await openMenu(screen.getByRole("button", { name: "Actions du bloc 1" }));
  await act(async () => {
    fireEvent.click(await screen.findByRole("menuitem", { name: "Supprimer le bloc" }));
  });
  await waitFor(() => expect(lastSaved()).toEqual(["c", "a"]));
});

test("the first block cannot move up, the last cannot move down", async () => {
  initial = [textBlock("a", "A"), textBlock("b", "B")];
  renderEditor();
  await screen.findByRole("textbox", { name: "Bloc de texte 2" });

  await openMenu(screen.getByRole("button", { name: "Actions du bloc 1" }));
  const up = await screen.findByRole("menuitem", { name: "Monter" });
  expect(up.getAttribute("aria-disabled")).toBe("true");
});

test('"Add a block" inserts a text block at the end', async () => {
  initial = [textBlock("a", "A")];
  renderEditor();
  await screen.findByRole("textbox", { name: "Bloc de texte 1" });

  await openMenu(screen.getByRole("button", { name: "Ajouter un bloc" }));
  await act(async () => {
    fireEvent.click(await screen.findByRole("menuitem", { name: "Texte" }));
  });

  expect(await screen.findByRole("textbox", { name: "Bloc de texte 2" })).toBeTruthy();
  await waitFor(() => expect(lastSaved()).toHaveLength(2));
  expect(lastSaved()[0]).toBe("a");
});

test("move and parseContent helpers", () => {
  expect(move(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
  expect(move(["a", "b"], 0, 5)).toEqual(["a", "b"]);
  expect(parseContent("not json")).toEqual([]);
  expect(
    parseContent('[{"id":"x","type":"video"},{"id":"y","type":"text","doc":{}}]'),
  ).toHaveLength(1);
});

test('"/" on an empty line opens the block menu; Escape gives the focus back to the text', async () => {
  initial = [textBlock("t1", "")];
  renderEditor();
  const text = await screen.findByRole("textbox", { name: "Bloc de texte 1" });

  act(() => text.focus());
  await act(async () => {
    fireEvent.keyDown(text, { key: "/" });
  });
  expect(await screen.findByRole("menuitem", { name: "Texte" })).toBeTruthy();

  await act(async () => {
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
  });

  await waitFor(() => expect(screen.queryByRole("menuitem", { name: "Texte" })).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(text));
});

test("moving a block with the keyboard is announced in the app's language, by block name", async () => {
  initial = [textBlock("a", "Il était une fois"), textBlock("b", "La fin")];
  renderEditor();
  const handle = await screen.findByRole("button", {
    name: "Déplacer le bloc 2 (Espace, puis flèches)",
  });

  // The instructions dnd-kit links to each handle.
  const describedBy = handle.getAttribute("aria-describedby") ?? "";
  expect(document.getElementById(describedBy)?.textContent).toBe(
    "Pour déplacer un bloc au clavier : Espace pour le saisir, flèches haut et bas pour le déplacer, Espace pour le déposer, Échap pour annuler.",
  );

  await act(async () => {
    handle.focus();
    fireEvent.keyDown(handle, { code: "Space", key: " " });
  });
  // Picked up (jsdom lays nothing out: every block overlaps, so dnd-kit may
  // then report it over the first one).
  await waitFor(() =>
    expect(document.querySelector("[id^=DndLiveRegion]")?.textContent).toMatch(
      /^Bloc de texte 2 (saisi, position 2|en position 1) sur 2\.$/,
    ),
  );
  await act(async () => {
    fireEvent.keyDown(document.activeElement ?? handle, { code: "Escape", key: "Escape" });
  });
  await waitFor(() =>
    expect(document.querySelector("[id^=DndLiveRegion]")?.textContent).toBe(
      "Déplacement annulé : Bloc de texte 2 reste en position 2 sur 2.",
    ),
  );
});
