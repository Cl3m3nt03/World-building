import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, type JSONContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { EntityChip } from "./mentions/EntityChip";
import { entityNames } from "./mentions/entities";
import {
  type ChipListener,
  cardEntities,
  entityPluginKey,
  linkDetectedAtCaret,
  REFRESH_ENTITIES,
} from "./mentions/entityExtension";
import { useMentionWorld } from "./mentions/MentionContext";
import { MentionSuggestions } from "./mentions/MentionSuggestions";
import { cardMention } from "./mentions/mentionExtension";
import { searchMentions } from "./mentions/search";
import { createSuggestionStore } from "./mentions/suggestionStore";

type TextBlockEditorProps = {
  /** The card being edited (left out of its own mentions). */
  cardId: string;
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
  // The latest cards, read by the "@" search built once with the editor.
  const world = useMentionWorld();
  const worldRef = useRef(world);
  worldRef.current = world;
  const [suggestions] = useState(createSuggestionStore);
  // Card names that can be detected or linked here, read by the editor's
  // extension at each keystroke.
  const names = useMemo(() => entityNames(world.cards, cardId), [world.cards, cardId]);
  const entitySource = useRef({ names, preferences: world.preferences });
  const [chip, setChip] = useState<Parameters<ChipListener>[0]>(null);

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
      cardMention((query) => searchMentions(worldRef.current.cards, query, cardId), suggestions),
      cardEntities(() => entitySource.current, setChip),
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
    onBlur: () => setChip(null),
  });

  // New cards, renamed cards or changed preferences: the extension reads
  // them from now on, and looks for the names again.
  const { preferences } = world;
  useEffect(() => {
    entitySource.current = { names, preferences };
    if (!editor || editor.isDestroyed) return;
    editor.view.dispatch(editor.state.tr.setMeta(entityPluginKey, REFRESH_ENTITIES));
  }, [editor, names, preferences]);

  return (
    <>
      <EditorContent editor={editor} />
      <MentionSuggestions store={suggestions} />
      {editor && chip && (
        <EntityChip
          chip={chip}
          onLink={() => {
            linkDetectedAtCaret(editor.view, () => entitySource.current);
            setChip(null);
          }}
        />
      )}
    </>
  );
}
