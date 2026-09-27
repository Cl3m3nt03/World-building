import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, type JSONContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useRef } from "react";
import { useTranslation } from "react-i18next";

type TextBlockEditorProps = {
  doc: JSONContent;
  /** Accessible name of the text area. */
  label: string;
  onChange: (doc: JSONContent) => void;
  /**
   * "/" typed on an empty line: open the block menu. `removeLine` deletes
   * that empty line (call it when a block is inserted in its place).
   */
  onSlash: (removeLine: () => void) => void;
  autoFocus?: boolean;
};

/**
 * Rich text of a text block (TipTap): headings, bold, italic, lists, quote,
 * with Markdown-like shortcuts ("# ", "- ", "> ", Ctrl+B…) and its own
 * undo / redo (Ctrl+Z, Ctrl+Y).
 */
export function TextBlockEditor({
  doc,
  label,
  onChange,
  onSlash,
  autoFocus,
}: TextBlockEditorProps) {
  const { t } = useTranslation();
  // Latest callbacks, read by the editor's handlers created once.
  const callbacks = useRef({ onChange, onSlash });
  callbacks.current = { onChange, onSlash };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: t("blocks.textPlaceholder") }),
    ],
    content: doc,
    autofocus: autoFocus ? "end" : false,
    editorProps: {
      attributes: {
        "aria-label": label,
        "aria-multiline": "true",
        role: "textbox",
        class:
          "prose-bz min-h-8 rounded-md px-2 py-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
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
          callbacks.current.onSlash(removeLine);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: current }) => callbacks.current.onChange(current.getJSON()),
  });

  return <EditorContent editor={editor} />;
}
