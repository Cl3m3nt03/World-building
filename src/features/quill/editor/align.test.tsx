// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Editor, type JSONContent } from "@tiptap/react";
import { afterEach, expect, test } from "vitest";
import { i18n } from "@/i18n";
import { cuePositions } from "../audio/cueMark";
import { notePositions } from "../notes/noteMark";
import { textAlignOf } from "./align";
import { EditorToolbar } from "./EditorToolbar";
import { quillExtensions } from "./extensions";
import { createListStore } from "./listStore";
import { countWords } from "./words";

let editor: Editor | null = null;
afterEach(() => {
  cleanup();
  editor?.destroy();
  editor = null;
});

/** A chapter's editor as Quill makes it, on a title and a paragraph with a note and a sound. */
function make() {
  editor = new Editor({
    extensions: quillExtensions({
      placeholder: "",
      slash: createListStore(),
      slashLabel: (command) => command,
      pickImage: () => {},
    }),
    content: {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Avant" }] },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "La " },
            { type: "text", text: "pluie", marks: [{ type: "note", attrs: { noteId: "n1" } }] },
            { type: "text", text: " tombait " },
            {
              type: "text",
              text: "fort",
              marks: [{ type: "audioCue", attrs: { cueId: "s1", kind: "effect" } }],
            },
          ],
        },
      ],
    },
  });
  return editor;
}

const blocks = (current: Editor): JSONContent[] => current.getJSON().content ?? [];

test("a draft without alignment reads as before: none on its blocks", () => {
  const current = make();
  expect(blocks(current).map(textAlignOf)).toEqual([null, null]);
  // Nothing written on the blocks: the page's own alignment.
  expect(current.getHTML()).not.toContain("text-align");
});

test("a paragraph and a title take an alignment, kept in the draft with its marks", () => {
  const current = make();
  const notes = notePositions(current);
  const cues = cuePositions(current);
  const words = countWords(current.getText());
  // The cursor in the paragraph.
  current.chain().setTextSelection(10).setTextAlign("center").run();
  expect(blocks(current).map(textAlignOf)).toEqual([null, "center"]);
  // Title and paragraph selected: both aligned.
  current.chain().selectAll().setTextAlign("right").run();
  expect(blocks(current).map(textAlignOf)).toEqual(["right", "right"]);
  current.chain().setTextSelection(2).setTextAlign("justify").run();
  expect(blocks(current).map(textAlignOf)).toEqual(["justify", "right"]);
  expect(current.getHTML()).toContain('style="text-align: right;"');
  // Notes, sounds and words are untouched.
  expect(notePositions(current)).toEqual(notes);
  expect(cuePositions(current)).toEqual(cues);
  expect(countWords(current.getText())).toBe(words);
  // An unknown alignment is refused.
  expect(current.commands.setTextAlign("sideways")).toBe(false);
});

test("Ctrl+Shift+L, E, R and J align the paragraph", () => {
  const current = make();
  current.commands.setTextSelection(10);
  const press = (key: string) => {
    const event = new KeyboardEvent("keydown", {
      key: key.toUpperCase(),
      keyCode: key.toUpperCase().charCodeAt(0),
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    current.view.someProp("handleKeyDown", (handle) => handle(current.view, event));
  };
  const paragraph = () => textAlignOf(blocks(current)[1] ?? {});
  press("e");
  expect(paragraph()).toBe("center");
  press("r");
  expect(paragraph()).toBe("right");
  press("j");
  expect(paragraph()).toBe("justify");
  press("l");
  expect(paragraph()).toBe("left");
});

test("the toolbar shows the paragraph's alignment and changes it", () => {
  const current = make();
  current.commands.setTextSelection(10);
  render(<EditorToolbar editor={current} onImage={() => {}} onHeader={() => {}} />);
  const button = (key: "left" | "center" | "right" | "justify") =>
    screen.getByRole("button", { name: i18n.t(`quill.toolbar.align.${key}`) });
  expect(
    screen
      .getByRole("group", { name: i18n.t("quill.toolbar.align.label") })
      .querySelectorAll("button"),
  ).toHaveLength(4);
  // None chosen: shown as left, as it is written.
  expect(button("left").getAttribute("aria-pressed")).toBe("true");
  expect(button("center").getAttribute("aria-pressed")).toBe("false");
  expect(button("right").getAttribute("aria-keyshortcuts")).toBe("Control+Shift+R");
  act(() => {
    fireEvent.click(button("center"));
  });
  expect(textAlignOf(blocks(current)[1] ?? {})).toBe("center");
  expect(button("center").getAttribute("aria-pressed")).toBe("true");
  expect(button("left").getAttribute("aria-pressed")).toBe("false");
});
