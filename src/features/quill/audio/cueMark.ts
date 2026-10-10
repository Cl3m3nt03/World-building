import type { JSONContent } from "@tiptap/react";
import { type Editor, Mark } from "@tiptap/react";
import type { CueKind } from "@/lib/bindings";

/**
 * The mark anchoring a sound to its passage (ADR 0010), like a note's: it
 * carries the sound's id (and its kind, for its look) and follows the text as
 * it changes. Not inclusive: typing at its edges does not extend the passage.
 */
export const AudioCueMark = Mark.create({
  name: "audioCue",
  inclusive: false,
  // A passage may hold an effect inside an ambience.
  excludes: "",
  addAttributes() {
    return {
      cueId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-cue-id"),
        renderHTML: (attributes) => (attributes.cueId ? { "data-cue-id": attributes.cueId } : {}),
      },
      kind: {
        default: "effect",
        parseHTML: (element) => element.getAttribute("data-cue-kind") ?? "effect",
        renderHTML: (attributes) => ({ "data-cue-kind": attributes.kind }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-cue-id]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", { ...HTMLAttributes, class: "quill-sound" }, 0];
  },
});

export type CuePlace = { cueId: string; kind: CueKind; from: number; to: number };

/** Where each sound's passage is in the text, once per sound, in order. */
export function cuePositions(editor: Editor): CuePlace[] {
  const found = new Map<string, CuePlace>();
  editor.state.doc.descendants((node, pos) => {
    for (const mark of node.marks) {
      if (mark.type.name !== "audioCue") continue;
      const cueId = String(mark.attrs.cueId ?? "");
      if (!cueId) continue;
      const known = found.get(cueId);
      if (known) known.to = Math.max(known.to, pos + node.nodeSize);
      else {
        const kind: CueKind = mark.attrs.kind === "ambience" ? "ambience" : "effect";
        found.set(cueId, { cueId, kind, from: pos, to: pos + node.nodeSize });
      }
    }
  });
  return [...found.values()].sort((a, b) => a.from - b.from);
}

/** Removes a sound's mark from the whole text (the sound is deleted). */
export function removeCueMark(editor: Editor, cueId: string) {
  const { tr } = editor.state;
  const type = editor.schema.marks.audioCue;
  if (!type) return;
  editor.state.doc.descendants((node, pos) => {
    for (const mark of node.marks) {
      if (mark.type === type && mark.attrs.cueId === cueId) {
        tr.removeMark(pos, pos + node.nodeSize, mark);
      }
    }
  });
  if (tr.docChanged) editor.view.dispatch(tr);
}

/** A sound's passage in a saved text: its words and its top-level blocks. */
export type CueSpan = { cueId: string; text: string; first: number; last: number };

/**
 * The sounds of a saved text (its JSON), in the order of the text, with the
 * words of their passage and the first and last top-level block they cover
 * (the reading with sound plays them there).
 */
export function cueSpans(doc: JSONContent): CueSpan[] {
  const spans = new Map<string, CueSpan>();
  const walk = (node: JSONContent, block: number) => {
    for (const mark of node.marks ?? []) {
      if (mark.type !== "audioCue") continue;
      const cueId = String(mark.attrs?.cueId ?? "");
      if (!cueId) continue;
      const span = spans.get(cueId);
      const text = node.text ?? "";
      if (span) {
        span.text = `${span.text}${span.last === block ? "" : " "}${text}`;
        span.last = block;
      } else {
        spans.set(cueId, { cueId, text, first: block, last: block });
      }
    }
    for (const child of node.content ?? []) walk(child, block);
  };
  for (const [index, node] of (doc.content ?? []).entries()) walk(node, index);
  return [...spans.values()].map((span) => ({ ...span, text: span.text.trim() }));
}
