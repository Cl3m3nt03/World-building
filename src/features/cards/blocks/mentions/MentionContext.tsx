import { createContext, useContext } from "react";
import type { Card, CardType, WorldPreferences } from "@/lib/bindings";

/** The world preferences before they are read: all on, as in a new world. */
export const DEFAULT_PREFERENCES: WorldPreferences = {
  entityDetection: true,
  autoMentionLinks: true,
  animateNewLinks: true,
};

/**
 * What mentions need from the world: the live cards (to show their current
 * name and spot dead references), the card types (icons), the writing
 * preferences (detection and automatic links of card names), and a way to
 * open a card. Provided by the card page around the block editor.
 */
export type MentionWorld = {
  cards: Card[];
  /** Cards in the trash: a mention of one shows its latest name, struck through. */
  trashed: Card[];
  types: CardType[];
  preferences: WorldPreferences;
  open: (cardId: string) => void;
};

export const MentionContext = createContext<MentionWorld>({
  cards: [],
  trashed: [],
  types: [],
  preferences: DEFAULT_PREFERENCES,
  open: () => {},
});

export function useMentionWorld(): MentionWorld {
  return useContext(MentionContext);
}
