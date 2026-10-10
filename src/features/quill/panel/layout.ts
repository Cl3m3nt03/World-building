/**
 * What the world panel keeps per story (`writing_panel.layout`): the tabs
 * (dockview's own JSON), the Home tab's blocks, and the writing mode's
 * look. Read with tolerance: a missing or odd field takes its default.
 */

/** What a block of the Home tab shows. */
export type BlockKind = "card" | "notes" | "moodboard" | "graph";

export const BLOCK_KINDS: BlockKind[] = ["card", "notes", "moodboard", "graph"];

/** A block of the Home tab, placed in px from the board's top left corner. */
export type HomeBlock = {
  id: string;
  kind: BlockKind;
  x: number;
  y: number;
  w: number;
  h: number;
  /** For a card block: the card shown. */
  cardId?: string;
  /** For a mood board: its images, in order. */
  assetIds?: string[];
};

/** How the writing mode looks: like the world (the app), or light, or dark. */
export type WritingStyle = "world" | "light" | "dark";

export type PanelLayout = {
  /** dockview's `toJSON()`, restored as is (null: the default tabs). */
  dock: unknown;
  blocks: HomeBlock[];
  style: WritingStyle;
};

export const MIN_BLOCK = { w: 160, h: 120 } as const;

/** The default size of a new block, by kind. */
export const BLOCK_SIZE: Record<BlockKind, { w: number; h: number }> = {
  card: { w: 260, h: 200 },
  notes: { w: 260, h: 240 },
  moodboard: { w: 300, h: 220 },
  graph: { w: 320, h: 260 },
};

const STYLES: WritingStyle[] = ["world", "light", "dark"];

function number(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function block(value: unknown): HomeBlock | null {
  if (typeof value !== "object" || value === null) return null;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== "string" || !BLOCK_KINDS.includes(item.kind as BlockKind)) return null;
  const kind = item.kind as BlockKind;
  const out: HomeBlock = {
    id: item.id,
    kind,
    x: Math.max(0, number(item.x, 0)),
    y: Math.max(0, number(item.y, 0)),
    w: Math.max(MIN_BLOCK.w, number(item.w, BLOCK_SIZE[kind].w)),
    h: Math.max(MIN_BLOCK.h, number(item.h, BLOCK_SIZE[kind].h)),
  };
  if (kind === "card") {
    if (typeof item.cardId !== "string") return null;
    out.cardId = item.cardId;
  }
  if (kind === "moodboard") {
    out.assetIds = Array.isArray(item.assetIds)
      ? item.assetIds.filter((id): id is string => typeof id === "string")
      : [];
  }
  return out;
}

/** A stored layout, read with tolerance. */
export function readLayout(json: string): PanelLayout {
  let value: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      value = parsed as Record<string, unknown>;
    }
  } catch {
    // An unreadable layout: the defaults.
  }
  return {
    dock: value.dock ?? null,
    blocks: Array.isArray(value.blocks) ? value.blocks.flatMap((item) => block(item) ?? []) : [],
    style: STYLES.includes(value.style as WritingStyle) ? (value.style as WritingStyle) : "world",
  };
}

/** Where a new block goes: under the others, at the left. */
export function newBlockPlace(blocks: HomeBlock[]): { x: number; y: number } {
  const bottom = blocks.reduce((max, item) => Math.max(max, item.y + item.h), 0);
  return { x: 0, y: blocks.length === 0 ? 0 : bottom + 12 };
}

/** A block moved by (dx, dy), kept in the board (no negative place). */
export function moved(item: HomeBlock, dx: number, dy: number): HomeBlock {
  return { ...item, x: Math.max(0, item.x + dx), y: Math.max(0, item.y + dy) };
}

/** A block resized by (dw, dh), kept at its minimum size. */
export function resized(item: HomeBlock, dw: number, dh: number): HomeBlock {
  return {
    ...item,
    w: Math.max(MIN_BLOCK.w, item.w + dw),
    h: Math.max(MIN_BLOCK.h, item.h + dh),
  };
}
