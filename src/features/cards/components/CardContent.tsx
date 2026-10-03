import type { Ref } from "react";
import { useCardTypes } from "@/features/card-types";
import { useCurrentWorld } from "@/features/world";
import type { Card } from "@/lib/bindings";
import { BlockEditor, type BlockEditorHandle } from "../blocks/BlockEditor";
import { DEFAULT_PREFERENCES, MentionContext } from "../blocks/mentions/MentionContext";
import { effectiveTemplate } from "../blocks/template";
import { useCardList } from "../hooks/useCards";

type Props = {
  card: Card;
  /** Opens a mentioned card. */
  open: (cardId: string) => void;
  /** Whether a mentioned card can be opened (else its name only). */
  canOpen?: (cardId: string) => boolean;
  ref?: Ref<BlockEditorHandle>;
};

/**
 * A card's content: its blocks, with the mentions of the world's cards
 * (current names, dead references). Shown by the card page in World and in
 * the wiki: the same text, edited from either.
 */
export function CardContent({ card, open, canOpen, ref }: Props) {
  const types = useCardTypes();
  // Live cards, for the mentions (current names, dead references).
  const allCards = useCardList(false);
  const trashedCards = useCardList(true);
  const { data: world } = useCurrentWorld();
  const all = types.data ?? [];
  const type = all.find((candidate) => candidate.id === card.typeId);
  const template = effectiveTemplate(type, all);
  // The type the template comes from (a subtype may use its parent's).
  const templateSource =
    type && type.guidedTemplate.length === 0 && type.parentId
      ? all.find((candidate) => candidate.id === type.parentId)
      : type;

  return (
    <MentionContext.Provider
      value={{
        cards: allCards.data ?? [],
        trashed: trashedCards.data ?? [],
        types: all,
        preferences: world?.preferences ?? DEFAULT_PREFERENCES,
        open,
        canOpen,
      }}
    >
      <BlockEditor
        key={card.id}
        ref={ref ?? null}
        cardId={card.id}
        template={template}
        templateName={templateSource?.name ?? ""}
      />
    </MentionContext.Provider>
  );
}
