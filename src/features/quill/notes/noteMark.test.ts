// @vitest-environment jsdom
import { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, expect, test } from "vitest";
import { NoteMark, notePositions, removeNoteMark } from "./noteMark";

let editor: Editor | null = null;
afterEach(() => editor?.destroy());

function make() {
  editor = new Editor({
    extensions: [StarterKit, NoteMark],
    content: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "La " },
            { type: "text", text: "pluie", marks: [{ type: "note", attrs: { noteId: "n1" } }] },
            { type: "text", text: " tombait " },
            {
              type: "text",
              text: "sur",
              marks: [{ type: "bold" }, { type: "note", attrs: { noteId: "n2" } }],
            },
            { type: "text", text: " la", marks: [{ type: "note", attrs: { noteId: "n2" } }] },
          ],
        },
      ],
    },
  });
  return editor;
}

test("notes are found once each, in order, with their whole passage", () => {
  const current = make();
  expect(notePositions(current)).toEqual([
    { noteId: "n1", from: 4, to: 9 },
    { noteId: "n2", from: 18, to: 24 },
  ]);
  expect(current.getHTML()).toContain('<span data-note-id="n1" class="quill-note">pluie</span>');
});

test("a deleted note's mark leaves the text, the others stay", () => {
  const current = make();
  removeNoteMark(current, "n2");
  expect(notePositions(current).map((note) => note.noteId)).toEqual(["n1"]);
  expect(current.getText()).toBe("La pluie tombait sur la");
  expect(current.getHTML()).toContain("<strong>sur</strong>");
});
