/**
 * D&D 5e rules used by the stat block (the game terms of the SRD, not its
 * text): the six abilities, their modifier, and the 18 skills with their
 * ability.
 */

export const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;
export type Ability = (typeof ABILITIES)[number];

export const MIN_SCORE = 1;
export const MAX_SCORE = 30;

export const SKILLS = [
  { key: "acrobatics", ability: "dex" },
  { key: "animalHandling", ability: "wis" },
  { key: "arcana", ability: "int" },
  { key: "athletics", ability: "str" },
  { key: "deception", ability: "cha" },
  { key: "history", ability: "int" },
  { key: "insight", ability: "wis" },
  { key: "intimidation", ability: "cha" },
  { key: "investigation", ability: "int" },
  { key: "medicine", ability: "wis" },
  { key: "nature", ability: "int" },
  { key: "perception", ability: "wis" },
  { key: "performance", ability: "cha" },
  { key: "persuasion", ability: "cha" },
  { key: "religion", ability: "int" },
  { key: "sleightOfHand", ability: "dex" },
  { key: "stealth", ability: "dex" },
  { key: "survival", ability: "wis" },
] as const satisfies readonly { key: string; ability: Ability }[];
export type Skill = (typeof SKILLS)[number]["key"];

/** Ability modifier: ⌊(score − 10) / 2⌋ (a 15 gives +2, a 9 gives −1). */
export function modifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/** "+2", "−1", "+0": a bonus with its sign (a true minus sign). */
export function formatBonus(bonus: number): string {
  return bonus < 0 ? `\u2212${Math.abs(bonus)}` : `+${bonus}`;
}

/** Skill bonus: the ability modifier, plus the proficiency bonus if proficient. */
export function skillBonus(score: number, proficient: boolean, proficiencyBonus: number): number {
  return modifier(score) + (proficient ? proficiencyBonus : 0);
}

/** A whole number typed as `text`, kept within [min, max]; `null` when it is not one. */
export function readWholeNumber(text: string, min: number, max: number): number | null {
  if (!/^\s*-?\d+\s*$/.test(text)) return null;
  return Math.min(max, Math.max(min, Number.parseInt(text, 10)));
}
