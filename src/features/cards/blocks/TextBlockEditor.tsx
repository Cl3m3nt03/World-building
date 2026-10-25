import Placeholder from "@tiptap/extension-placeholder";
import { type Editor, EditorContent, type JSONContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { useWorldInText, WorldInTextOverlay } from "./mentions/useWorldInText";

/** What the « / » menu can make of the empty line it was typed on (V2-3.4). */
export type TextFormat = "paragraph" | "h1" | "h2" | "h3" | "bullets" | "numbers" | "quote";

/** Turns the line under the caret into `kind`, the focus back in the text. */
function applyFormat(editor: Editor | null, kind: TextFormat) {
  if (!editor) return;
  const chain = editor.chain().focus();
  if (kind === "paragraph") chain.setParagraph().run();
  else if (kind === "h1") chain.setHeading({ level: 1 }).run();
  else if (kind === "h2") chain.setHeading({ level: 2 }).run();
  else if (kind === "h3") chain.setHeading({ level: 3 }).run();
  else if (kind === "bullets") chain.toggleBulletList().run();
  else if (kind === "numbers") chain.toggleOrderedList().run();
  else chain.toggleBlockquote().run();
}

type TextBlockEditorProps = {
  /** The card being edited (left out of its own mentions). */
  cardId: string;
  doc: JSONContent;
  /** Accessible name of the text area. */
  label: string;
  onChange: (doc: JSONContent) => void;
  /**
   * "/" typed on an empty line: open the block menu. `removeLine` deletes
   * that empty line (call it when a block is inserted in its place);
   * `refocus` puts the focus back on that line (the menu was closed).
   */
  onSlash: (
    removeLine: () => void,
    refocus: () => void,
    format: (kind: TextFormat) => void,
  ) => void;
  autoFocus?: boolean;
  /** Help question of a guided template section (shown under its title while empty). */
  prompt?: string | undefined;
};

/**
 * Rich text of a text block (TipTap): headings, bold, italic, lists, quote,
 * with Markdown-like shortcuts ("# ", "- ", "> ", Ctrl+B…) and its own
 * undo / redo (Ctrl+Z, Ctrl+Y).
 */
export function TextBlockEditor({
  cardId,
  doc,
  label,
  onChange,
  onSlash,
  autoFocus,
  prompt,
}: TextBlockEditorProps) {
  const { t } = useTranslation();
  // Latest callbacks, read by the editor's handlers created once.
  const callbacks = useRef({ onChange, onSlash });
  callbacks.current = { onChange, onSlash };
  const worldInText = useWorldInText(cardId);

  const editorRef = useRef<Editor | null>(null);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({
        // Every empty line is checked, not only the current one: a template's
        // help question shows under its title before the line is focused.
        showOnlyCurrent: false,
        placeholder: ({ editor: current, node, pos }) => {
          if (prompt && node.type.name === "paragraph") {
            const $pos = current.state.doc.resolve(pos);
            const before = $pos.parent.maybeChild($pos.index() - 1);
            if (before?.type.name === "heading") return prompt;
          }
          return current.isEmpty ? t("blocks.textPlaceholder") : "";
        },
      }),
      ...worldInText.extensions,
    ],
    content: doc,
    autofocus: autoFocus ? "end" : false,
    // TipTap applies `autofocus` a moment later (a timeout, then an
    // animation frame): letters typed right after the block appeared went
    // nowhere. The focus is taken as soon as the editor is in the page (its
    // element is attached right after this event).
    onMount: ({ editor: mounted }) => {
      if (!autoFocus) return;
      queueMicrotask(() => {
        if (mounted.isDestroyed || !mounted.view.dom.isConnected) return;
        mounted.commands.focus("end");
        mounted.view.focus();
      });
    },
    editorProps: {
      attributes: {
        "aria-label": label,
        "aria-multiline": "true",
        role: "textbox",
        class:
          "prose-bz card-text min-h-8 rounded-md px-2 py-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
      },
      handleKeyDown: (view, event) => {
        const { $from, empty } = view.state.selection;
        const lineIsEmpty = empty && $from.parent.textContent === "";
        if (event.key === "/" && lineIsEmpty) {
          event.preventDefault();
          const start = $from.before();
          const removeLine = () => {
            const { state } = view;
            const line = state.doc.resolve(Math.min(start, state.doc.content.size)).nodeAfter;
            // Keep the only line of a block, and never delete text.
            if (state.doc.childCount > 1 && line?.isTextblock && line.textContent === "") {
              view.dispatch(state.tr.delete(start, start + line.nodeSize));
            }
          };
          callbacks.current.onSlash(
            removeLine,
            () => view.focus(),
            (kind) => applyFormat(editorRef.current, kind),
          );
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: current }) => callbacks.current.onChange(current.getJSON()),
    onBlur: worldInText.hideChip,
  });

  editorRef.current = editor;

  return (
    <>
      <EditorContent editor={editor} />
      <WorldInTextOverlay editor={editor} overlay={worldInText.overlay} />
    </>
  );
}
