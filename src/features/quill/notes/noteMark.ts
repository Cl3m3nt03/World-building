import { type Editor, Mark } from "@tiptap/react";

/**
 * The mark anchoring a note to its passage (ADR 0009): it carries the note's
 * id and follows the text as it changes. Not inclusive: typing at its edges
 * does not extend the passage.
 */
export const NoteMark = Mark.create({
  name: "note",
  inclusive: false,
  addAttributes() {
    return {
      noteId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-note-id"),
        renderHTML: (attributes) =>
          attributes.noteId ? { "data-note-id": attributes.noteId } : {},
      },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-note-id]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", { ...HTMLAttributes, class: "quill-note" }, 0];
  },
});

/** Where each note's passage starts in the text, once per note, in order. */
export function notePositions(editor: Editor): { noteId: string; from: number; to: number }[] {
  const found = new Map<string, { noteId: string; from: number; to: number }>();
  editor.state.doc.descendants((node, pos) => {
    for (const mark of node.marks) {
      if (mark.type.name !== "note") continue;
      const noteId = String(mark.attrs.noteId ?? "");
      if (!noteId) continue;
      const known = found.get(noteId);
      if (known) known.to = Math.max(known.to, pos + node.nodeSize);
      else found.set(noteId, { noteId, from: pos, to: pos + node.nodeSize });
    }
  });
  return [...found.values()].sort((a, b) => a.from - b.from);
}

/** Removes a note's mark from the whole text (the note is deleted). */
export function removeNoteMark(editor: Editor, noteId: string) {
  const { tr } = editor.state;
  const type = editor.schema.marks.note;
  if (!type) return;
  editor.state.doc.descendants((node, pos) => {
    for (const mark of node.marks) {
      if (mark.type === type && mark.attrs.noteId === noteId) {
        tr.removeMark(pos, pos + node.nodeSize, mark);
      }
    }
  });
  if (tr.docChanged) editor.view.dispatch(tr);
}
