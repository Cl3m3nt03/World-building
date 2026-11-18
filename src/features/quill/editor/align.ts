import type { JSONContent } from "@tiptap/react";

/** The alignments a chapter's paragraphs and titles can take (#605). */
export const TEXT_ALIGNS = ["left", "center", "right", "justify"] as const;

export type TextAlign = (typeof TEXT_ALIGNS)[number];

/** The nodes that can be aligned. */
export const ALIGNABLE = ["paragraph", "heading"] as const;

function isTextAlign(value: unknown): value is TextAlign {
  return TEXT_ALIGNS.includes(value as TextAlign);
}

/**
 * The alignment chosen for a block of a chapter's text (its TipTap
 * `textAlign`), or null for none: the page's own (left while writing,
 * justified in the book). An unknown value is none.
 */
export function textAlignOf(node: JSONContent): TextAlign | null {
  const value: unknown = node.attrs?.textAlign;
  return isTextAlign(value) ? value : null;
}
