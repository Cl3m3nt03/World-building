import { createContext, useContext } from "react";
import type { Card, CardType } from "@/lib/bindings";

/**
 * What mentions need from the world: the live cards (to show their current
 * name and spot dead references), the card types (icons), and a way to open
 * a card. Provided by the card page around the block editor.
 */
export type MentionWorld = {
  cards: Card[];
  /** Cards in the trash: a mention of one shows its latest name, struck through. */
  trashed: Card[];
  types: CardType[];
  open: (cardId: string) => void;
};

export const MentionContext = createContext<MentionWorld>({
  cards: [],
  trashed: [],
  types: [],
  open: () => {},
});

export function useMentionWorld(): MentionWorld {
  return useContext(MentionContext);
}
