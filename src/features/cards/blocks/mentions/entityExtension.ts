import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { type EditorState, Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import { Extension, InputRule } from "@tiptap/react";
import type { WorldPreferences } from "@/lib/bindings";
import { type EntityName, type Found, findEntities, isBoundary, nameToLink } from "./entities";
import { markFresh } from "./fresh";

/** What the extension reads each time it runs (the latest cards and preferences). */
export type EntitySource = () => { names: EntityName[]; preferences: WorldPreferences };

/** A detected name in the document (positions in the document). */
export type DetectedEntity = { from: number; to: number; entity: EntityName };

/** Where the caret is on a detected name, for the "Link" chip; `null` when it is not. */
export type ChipListener = (chip: { detected: DetectedEntity; rect: DOMRect } | null) => void;

export const entityPluginKey = new PluginKey<DecorationSet>("cardEntities");

/** Transaction meta asking to look for the names again (cards or preferences changed). */
export const REFRESH_ENTITIES = "refresh";

/** Stands for a non-text inline node (a mention…): one position, not a word character. */
const OBJECT = "￼";

/** The text of a textblock, one character per document position. */
function blockText(block: ProseMirrorNode): string {
  let text = "";
  block.forEach((child) => {
    text += child.isText ? (child.text ?? "") : OBJECT.repeat(child.nodeSize);
  });
  return text;
}

/** The names written in the document, outside code. */
export function detectEntities(doc: ProseMirrorNode, names: EntityName[]): DetectedEntity[] {
  const detected: DetectedEntity[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    if (node.type.spec.code) return false;
    for (const found of findEntities(blockText(node), names)) {
      detected.push({ from: pos + 1 + found.from, to: pos + 1 + found.to, entity: found.entity });
    }
    return false;
  });
  return detected;
}

/** Replaces `from`–`to` by a mention of `entity`'s card, marked as new for its animation. */
function linkInto(
  state: EditorState,
  from: number,
  to: number,
  entity: EntityName,
  animate: boolean,
) {
  const mention = state.schema.nodes.mention?.create({
    id: entity.card.id,
    label: entity.card.title,
  });
  if (!mention) return null;
  if (animate) markFresh(mention);
  return { tr: state.tr.replaceWith(from, to, mention), mention };
}

/** The detected name under a collapsed caret (from its start to its end included). */
function detectedAtCaret(state: EditorState, source: EntitySource): DetectedEntity | null {
  const { selection } = state;
  if (!selection.empty || !source().preferences.entityDetection) return null;
  const set = entityPluginKey.getState(state);
  const pos = selection.from;
  const around = set?.find(pos, pos) ?? [];
  const decoration = around.find((candidate) => candidate.from <= pos && pos <= candidate.to);
  const entity = decoration?.spec.entity as EntityName | undefined;
  return decoration && entity ? { from: decoration.from, to: decoration.to, entity } : null;
}

/** Turns the detected name under the caret into a mention. */
export function linkDetectedAtCaret(view: EditorView, source: EntitySource): boolean {
  const detected = detectedAtCaret(view.state, source);
  if (!detected) return false;
  const linked = linkInto(
    view.state,
    detected.from,
    detected.to,
    detected.entity,
    source().preferences.animateNewLinks,
  );
  if (!linked) return false;
  view.dispatch(linked.tr.scrollIntoView());
  return true;
}

/**
 * Card names in text blocks (world preferences):
 * - automatic mention links: a name typed then followed by a space, a
 *   punctuation mark or Enter becomes a mention; Backspace right after gives
 *   the text back (an undoable input rule);
 * - entity detection: names written in the text are underlined, and the one
 *   under the caret can be linked ("Link" chip, Alt+Enter).
 */
export function cardEntities(source: EntitySource, onChip: ChipListener) {
  return Extension.create({
    name: "cardEntities",

    addInputRules() {
      return [
        new InputRule({
          find: (text) => {
            const typed = text.at(-1);
            if (!isBoundary(typed) || typed === "@") return null;
            const { names, preferences } = source();
            if (!preferences.autoMentionLinks) return null;
            const found = nameToLink(text.slice(0, -1), typed ?? "", names);
            if (!found) return null;
            return { index: found.from, text: text.slice(found.from), data: { found } };
          },
          handler: ({ state, range, match }) => {
            const found = match.data?.found as Found | undefined;
            const typed = match[0]?.at(-1);
            if (!found || typed === undefined) return null;
            const animate = source().preferences.animateNewLinks;
            const nameEnd = range.from + (found.to - found.from);
            const linked = linkInto(state, range.from, nameEnd, found.entity, animate);
            if (!linked) return null;
            // The typed character (space, punctuation) goes where it was typed,
            // after the mention and the words that followed it, if any.
            linked.tr.insertText(typed, linked.tr.mapping.map(range.to));
          },
        }),
      ];
    },

    addKeyboardShortcuts() {
      return {
        // Enter also ends a name: link it, then let Enter make the new line.
        Enter: ({ editor }) => {
          const { state, view } = editor;
          const { selection } = state;
          const { names, preferences } = source();
          if (!preferences.autoMentionLinks || !selection.empty) return false;
          const $from = selection.$from;
          if ($from.parent.type.spec.code) return false;
          const before = blockText($from.parent).slice(0, $from.parentOffset);
          // A line end cannot continue a longer name: a waiting one is linked.
          const found = nameToLink(before, "\n", names);
          if (!found) return false;
          const linked = linkInto(
            state,
            $from.start() + found.from,
            $from.start() + found.to,
            found.entity,
            preferences.animateNewLinks,
          );
          if (linked) view.dispatch(linked.tr);
          return false;
        },
        "Alt-Enter": ({ editor }) => linkDetectedAtCaret(editor.view, source),
      };
    },

    addProseMirrorPlugins() {
      const decorate = (doc: ProseMirrorNode) => {
        const { names, preferences } = source();
        if (!preferences.entityDetection) return DecorationSet.empty;
        return DecorationSet.create(
          doc,
          detectEntities(doc, names).map(({ from, to, entity }) =>
            Decoration.inline(
              from,
              to,
              { class: "entity-detected", "data-card-id": entity.card.id },
              { entity },
            ),
          ),
        );
      };

      return [
        new Plugin<DecorationSet>({
          key: entityPluginKey,
          state: {
            init: (_, state) => decorate(state.doc),
            apply: (tr, set, _old, state) =>
              tr.docChanged || tr.getMeta(entityPluginKey) === REFRESH_ENTITIES
                ? decorate(state.doc)
                : set,
          },
          props: {
            decorations: (state) => entityPluginKey.getState(state),
          },
          view: () => {
            // The chip shows when the caret is moved onto a name (click,
            // arrows), never while typing: typing hides it.
            let shown = false;
            const show = (view: EditorView) => {
              const detected = view.hasFocus() ? detectedAtCaret(view.state, source) : null;
              shown = detected !== null;
              if (!detected) {
                onChip(null);
                return;
              }
              const start = view.coordsAtPos(detected.from);
              const end = view.coordsAtPos(detected.to);
              onChip({
                detected,
                rect: new DOMRect(
                  start.left,
                  start.top,
                  end.right - start.left,
                  end.bottom - start.top,
                ),
              });
            };
            return {
              update: (view, previous) => {
                if (!view.state.doc.eq(previous.doc)) {
                  if (shown) onChip(null);
                  shown = false;
                } else if (!view.state.selection.eq(previous.selection) || shown) {
                  show(view);
                }
              },
              destroy: () => onChip(null),
            };
          },
        }),
      ];
    },
  });
}
