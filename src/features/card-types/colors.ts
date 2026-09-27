import type { TranslationKey } from "@/i18n";

/** Type colors, stored by name in the world (see `COLORS` in card_types.rs). */
export const TYPE_COLORS = [
  "red",
  "orange",
  "amber",
  "green",
  "teal",
  "blue",
  "violet",
  "pink",
  "slate",
] as const;

export type TypeColor = (typeof TYPE_COLORS)[number];

export function colorLabel(color: string): TranslationKey {
  return (TYPE_COLORS as readonly string[]).includes(color)
    ? (`cardTypes.color.${color}` as TranslationKey)
    : "cardTypes.color.slate";
}

/** CSS color of a type (theme-aware token). */
export function typeColor(color: string): string {
  return (TYPE_COLORS as readonly string[]).includes(color)
    ? `var(--bz-type-${color})`
    : "var(--bz-type-slate)";
}
