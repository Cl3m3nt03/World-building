// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Editor, JSONContent } from "@tiptap/react";
import { afterEach, expect, test, vi } from "vitest";
import type { Card, WorldPreferences } from "@/lib/bindings";
import { TextBlockEditor } from "../TextBlockEditor";
import { entityNames, findEntities, nameEndingText, nameToLink } from "./entities";
import { DEFAULT_PREFERENCES, MentionContext } from "./MentionContext";

// jsdom does not lay out text: ProseMirror scrolls the caret into view with these.
const noRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] });
for (const proto of [Range.prototype, Element.prototype]) {
  if (!("getClientRects" in proto)) {
    Object.defineProperty(proto, "getClientRects", { value: noRects, configurable: true });
  }
}
Range.prototype.getBoundingClientRect ??= () => new DOMRect();

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function card(id: string, title: string, aliases: string[] = []): Card {
  return {
    id,
    title,
    typeId: null,
    imageAssetId: null,
    aliases,
    createdAt: "2026-09-28T10:00:00Z",
    updatedAt: "2026-09-28T10:00:00Z",
    trashedAt: null,
  };
}

const CARDS = [
  card("gondor", "Gondor"),
  card("minas", "Minas"),
  card("minas-tirith", "Minas Tirith", ["la Cité Blanche"]),
  card("aragorn", "Aragorn", ["Grands-Pas"]),
  card("x", "X"),
];

const texts = (found: { entity: { name: string } }[]) => found.map((f) => f.entity.name);

test("the names are the titles and aliases, longest first, without the card edited", () => {
  const names = entityNames(CARDS, "aragorn");
  expect(names.map((n) => n.name)).toEqual(["la Cité Blanche", "Minas Tirith", "Gondor", "Minas"]);
  // A one-letter name is left out; so is a name shared by two cards.
  const shared = entityNames([card("a", "Sam"), card("b", "sam")], "none");
  expect(shared).toEqual([]);
});

test("names are found as whole words, the longest first, case ignored", () => {
  const names = entityNames(CARDS, "none");
  expect(texts(findEntities("Aragorn quitte minas tirith pour le Gondor.", names))).toEqual([
    "Aragorn",
    "Minas Tirith",
    "Gondor",
  ]);
  // Inside a word, or right after "@", it is not a name.
  expect(findEntities("Gondoriens, @Gondor", names)).toEqual([]);
  expect(texts(findEntities("Grands-Pas arrive", names))).toEqual(["Grands-Pas"]);
});

test("the name that ends a text is the one just typed", () => {
  const names = entityNames(CARDS, "none");
  expect(nameEndingText("Il part pour Minas Tirith", names)?.entity.name).toBe("Minas Tirith");
  expect(nameEndingText("Il part pour Minas", names)?.entity.name).toBe("Minas");
  expect(nameEndingText("Les Gondoriens", names)).toBeNull();
  expect(nameEndingText("Vers @Gondor", names)).toBeNull();
});

test("a name waits while a longer one may be typed", () => {
  const names = entityNames(CARDS, "none");
  const link = (before: string, separator = " ") => nameToLink(before, separator, names);
  // "Minas" then a space: "Minas Tirith" may come.
  expect(link("Vers Minas")).toBeNull();
  // It came: the longer name is linked.
  expect(link("Vers Minas Tirith")).toMatchObject({ from: 5, to: 17 });
  // It did not: "Minas" is linked when the next word ends.
  expect(link("Vers Minas est")).toMatchObject({ from: 5, to: 10, entity: { name: "Minas" } });
  // A comma cannot start "Minas Tirith": linked at once.
  expect(link("Vers Minas", ",")).toMatchObject({ entity: { name: "Minas" } });
  expect(link("Vers la ville")).toBeNull();
});

// --- In the editor --------------------------------------------------------------

function renderEditor(
  preferences: Partial<WorldPreferences> = {},
  doc: JSONContent = { type: "doc", content: [{ type: "paragraph" }] },
) {
  const onChange = vi.fn();
  render(
    <MentionContext.Provider
      value={{
        cards: CARDS,
        trashed: [],
        types: [],
        preferences: { ...DEFAULT_PREFERENCES, ...preferences },
        open: () => {},
      }}
    >
      <TextBlockEditor
        cardId="aragorn"
        label="Bloc de texte 1"
        doc={doc}
        onChange={onChange}
        onSlash={() => {}}
      />
    </MentionContext.Provider>,
  );
  const dom = screen.getByRole("textbox", { name: "Bloc de texte 1" });
  const editor = (dom as HTMLElement & { editor: Editor }).editor;
  return { dom, editor, onChange };
}

/** Types `text` one character at a time, as the keyboard does (input rules run). */
function type(editor: Editor, text: string) {
  const { view } = editor;
  act(() => {
    for (const char of text) {
      const { from, to } = view.state.selection;
      const handled = view.someProp("handleTextInput", (handle) =>
        handle(view, from, to, char, () => view.state.tr.insertText(char, from, to)),
      );
      if (!handled) view.dispatch(view.state.tr.insertText(char, from, to));
    }
  });
}

function paragraph(editor: Editor) {
  return editor.getJSON().content?.[0]?.content ?? [];
}

test("a typed card name becomes a mention at the next space, and Backspace gives the text back", async () => {
  const { dom, editor } = renderEditor();
  act(() => editor.commands.focus());

  type(editor, "Allié du gondor ");

  expect(paragraph(editor)).toEqual([
    { type: "text", text: "Allié du " },
    { type: "mention", attrs: { id: "gondor", label: "Gondor", mentionSuggestionChar: "@" } },
    { type: "text", text: " " },
  ]);
  // The new mention plays its animation.
  await waitFor(() => expect(dom.querySelector(".mention-fresh")).not.toBeNull());

  act(() => {
    fireEvent.keyDown(dom, { key: "Backspace" });
  });
  expect(paragraph(editor)).toEqual([{ type: "text", text: "Allié du gondor " }]);
});

test("punctuation and Enter also end a name; the card edited and the text after @ are never linked", () => {
  const { dom, editor } = renderEditor();
  act(() => editor.commands.focus());

  type(editor, "Aragorn et Minas Tirith, puis Minas vers ");
  act(() => {
    fireEvent.keyDown(dom, { key: "Enter" });
  });
  type(editor, "Gondor");

  const json = editor.getJSON().content ?? [];
  expect(json[0]?.content).toEqual([
    { type: "text", text: "Aragorn et " },
    {
      type: "mention",
      attrs: { id: "minas-tirith", label: "Minas Tirith", mentionSuggestionChar: "@" },
    },
    { type: "text", text: ", puis " },
    { type: "mention", attrs: { id: "minas", label: "Minas", mentionSuggestionChar: "@" } },
    { type: "text", text: " vers " },
  ]);
  // Not linked yet: nothing typed after it.
  expect(json[1]?.content).toEqual([{ type: "text", text: "Gondor" }]);
  act(() => {
    fireEvent.keyDown(dom, { key: "Enter" });
  });
  expect(editor.getJSON().content?.[1]?.content?.[0]).toMatchObject({
    type: "mention",
    attrs: { id: "gondor" },
  });

  // A name waiting for a longer one is linked at the line end.
  type(editor, "Minas");
  act(() => {
    fireEvent.keyDown(dom, { key: "Enter" });
  });
  expect(editor.getJSON().content?.[2]?.content?.[0]).toMatchObject({
    type: "mention",
    attrs: { id: "minas" },
  });
});

test("with automatic links off, a typed name stays text; without animation, no animation", async () => {
  const off = renderEditor({ autoMentionLinks: false });
  act(() => off.editor.commands.focus());
  type(off.editor, "Vers le Gondor ");
  expect(paragraph(off.editor)).toEqual([{ type: "text", text: "Vers le Gondor " }]);
  cleanup();

  const still = renderEditor({ animateNewLinks: false });
  act(() => still.editor.commands.focus());
  type(still.editor, "Vers le Gondor ");
  await waitFor(() => expect(still.dom.querySelector(".mention")).not.toBeNull());
  expect(still.dom.querySelector(".mention-fresh")).toBeNull();
});

const WRITTEN: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Il vit au Gondor depuis." }] }],
};

test("names already written are underlined, and linked with Alt+Enter or the chip", () => {
  const { dom, editor } = renderEditor({ autoMentionLinks: false }, WRITTEN);
  const detected = dom.querySelector(".entity-detected");
  expect(detected?.textContent).toBe("Gondor");
  expect(detected?.getAttribute("data-card-id")).toBe("gondor");

  // The caret on the name: Alt+Enter links it.
  act(() => {
    editor.commands.focus();
    editor.commands.setTextSelection(13);
  });
  act(() => {
    fireEvent.keyDown(dom, { key: "Enter", altKey: true });
  });
  expect(paragraph(editor)[1]).toMatchObject({ type: "mention", attrs: { id: "gondor" } });
  expect(dom.querySelector(".entity-detected")).toBeNull();
});

test("with entity detection off, nothing is underlined", () => {
  const { dom } = renderEditor({ entityDetection: false }, WRITTEN);
  expect(dom.querySelector(".entity-detected")).toBeNull();
});
