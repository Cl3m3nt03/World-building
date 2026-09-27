import Mention from "@tiptap/extension-mention";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { MentionView } from "./MentionView";
import type { MentionSuggestion } from "./search";
import type { SuggestionStore } from "./suggestionStore";

/**
 * "@" mentions of cards. `search` gives the suggestions for a query (read
 * at each keystroke, so it always sees the current cards); `store` holds the
 * suggestion list shown by `MentionSuggestions`.
 *
 * A mention node keeps the card id and the name it had when inserted
 * (`label`): the name is shown for a dead reference, and read by search.
 */
export function cardMention(
  search: (query: string) => MentionSuggestion[],
  store: SuggestionStore,
) {
  return Mention.extend({
    addNodeView() {
      return ReactNodeViewRenderer(MentionView, { as: "span" });
    },
  }).configure({
    HTMLAttributes: { class: "mention" },
    renderText: ({ node }) => `@${String(node.attrs.label ?? "")}`,
    suggestion: {
      char: "@",
      // Card names have spaces ("Minas Tirith").
      allowSpaces: true,
      items: ({ query }) => search(query),
      render: () => {
        const show = (props: {
          items: MentionSuggestion[];
          clientRect?: (() => DOMRect | null) | null;
          command: (attrs: { id: string; label: string }) => void;
        }) =>
          store.show(props.items, props.clientRect?.() ?? null, (item) =>
            props.command({ id: item.card.id, label: item.card.title }),
          );
        return {
          onStart: show,
          onUpdate: show,
          onKeyDown: ({ event }) => {
            if (event.key === "ArrowDown") {
              store.move(1);
              return true;
            }
            if (event.key === "ArrowUp") {
              store.move(-1);
              return true;
            }
            if (event.key === "Enter" || event.key === "Tab") return store.pick();
            if (event.key === "Escape") {
              store.close();
              return true;
            }
            return false;
          },
          onExit: () => store.close(),
        };
      },
    },
  });
}
