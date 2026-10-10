import type { Editor } from "@tiptap/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { EntityChip } from "./EntityChip";
import { entityNames } from "./entities";
import {
  type ChipListener,
  cardEntities,
  entityPluginKey,
  linkDetectedAtCaret,
  REFRESH_ENTITIES,
} from "./entityExtension";
import { useMentionWorld } from "./MentionContext";
import { MentionSuggestions } from "./MentionSuggestions";
import { cardMention } from "./mentionExtension";
import { searchMentions } from "./search";
import { createSuggestionStore } from "./suggestionStore";

/**
 * The world in a text (a card's text block, a Quill chapter): "@" mentions of
 * cards, and card names detected as they are written (underlined, linked at
 * a boundary, a « Lier » chip under the caret), read from `MentionContext`.
 *
 * Give `extensions` to the editor once, call `hideChip` when it loses the
 * focus, and render `<WorldInTextOverlay>` next to it.
 */
export function useWorldInText(excludeId: string) {
  const world = useMentionWorld();
  // The latest cards, read by the "@" search built once with the editor.
  const worldRef = useRef(world);
  worldRef.current = world;
  const [suggestions] = useState(createSuggestionStore);
  // Card names that can be detected or linked here, read by the editor's
  // extension at each keystroke.
  const names = useMemo(() => entityNames(world.cards, excludeId), [world.cards, excludeId]);
  const entitySource = useRef({ names, preferences: world.preferences });
  const [chip, setChip] = useState<Parameters<ChipListener>[0]>(null);
  // Built once: the editor is made once with them.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the extensions read refs
  const extensions = useMemo(
    () => [
      cardMention((query) => searchMentions(worldRef.current.cards, query, excludeId), suggestions),
      cardEntities(() => entitySource.current, setChip),
    ],
    [],
  );
  return {
    extensions,
    hideChip: () => setChip(null),
    overlay: { names, preferences: world.preferences, entitySource, suggestions, chip, setChip },
  };
}

type Overlay = ReturnType<typeof useWorldInText>["overlay"];

/** The "@" suggestions and the « Lier » chip of a text, kept up to date. */
export function WorldInTextOverlay({
  editor,
  overlay,
}: {
  editor: Editor | null;
  overlay: Overlay;
}) {
  const { names, preferences, entitySource, suggestions, chip, setChip } = overlay;
  // New cards, renamed cards or changed preferences: the extension reads
  // them from now on, and looks for the names again.
  useEffect(() => {
    entitySource.current = { names, preferences };
    if (!editor || editor.isDestroyed) return;
    editor.view.dispatch(editor.state.tr.setMeta(entityPluginKey, REFRESH_ENTITIES));
  }, [editor, names, preferences, entitySource]);

  return (
    <>
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
