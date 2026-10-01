import { type Block, newId } from "./model";

/**
 * Blocks side by side (M3 step 3.11, docs/features/01-cartes-et-types.md).
 * The blocks stay a flat list: neighbouring blocks that carry the same
 * `row` id show on one line, each taking its `width` (a share of the line).
 * Search, media usages and mentions keep reading the flat list, and an older
 * version of the app shows the blocks one under the other.
 */

/** Most blocks on one line. */
export const MAX_ROW_BLOCKS = 3;
/** Narrowest column, as a share of the line. */
export const MIN_WIDTH = 0.2;
/** Widths snap to this step. */
export const WIDTH_STEP = 0.1;

/** A line of blocks: one block alone, or two or three side by side. */
export type Row = { id: string | null; blocks: Block[] };

function round(width: number): number {
  return Math.round(width * 100) / 100;
}

/** `block` without its place on a line. */
function alone(block: Block): Block {
  if (block.row === undefined && block.width === undefined) return block;
  const { row: _row, width: _width, ...rest } = block;
  return rest as Block;
}

/** Equal widths for `count` columns, summing to 1. */
function equalWidths(count: number): number[] {
  const share = round(1 / count);
  return Array.from({ length: count }, (_, index) =>
    index === count - 1 ? round(1 - share * (count - 1)) : share,
  );
}

/** Whether `widths` are usable: each at least the minimum, summing to 1. */
function validWidths(widths: (number | undefined)[]): widths is number[] {
  const sum = widths.reduce<number>((total, width) => total + (width ?? 0), 0);
  return (
    widths.every((width) => typeof width === "number" && width >= MIN_WIDTH - 1e-9) &&
    Math.abs(sum - 1) < 0.011
  );
}

/**
 * The blocks as lines: neighbours with the same row id, at most
 * {@link MAX_ROW_BLOCKS} per line (more start a new line).
 */
export function rows(blocks: Block[]): Row[] {
  const out: Row[] = [];
  for (const block of blocks) {
    const last = out.at(-1);
    if (block.row && last?.id === block.row && last.blocks.length < MAX_ROW_BLOCKS) {
      last.blocks.push(block);
    } else {
      out.push({ id: block.row ?? null, blocks: [block] });
    }
  }
  return out;
}

/**
 * Tidies the lines: a block alone loses its row id and width; the widths of
 * a line are kept if usable, otherwise shared equally. Applied when reading
 * a card and after every change, so any saved shape ends up valid.
 */
export function normalize(blocks: Block[]): Block[] {
  return rows(blocks).flatMap((row) => {
    if (row.blocks.length < 2) return row.blocks.map(alone);
    const saved = row.blocks.map((block) => block.width);
    const widths = validWidths(saved) ? saved : equalWidths(row.blocks.length);
    return row.blocks.map((block, index) => {
      const width = widths[index] ?? MIN_WIDTH;
      // Unchanged blocks keep their identity (no needless re-render).
      return block.width === width ? block : { ...block, width };
    });
  });
}

/** The line holding the block `id`, and its index among the lines. */
export function rowOf(blocks: Block[], id: string): { row: Row; index: number } | null {
  const all = rows(blocks);
  const index = all.findIndex((row) => row.blocks.some((block) => block.id === id));
  const row = all[index];
  return row ? { row, index } : null;
}

/**
 * Puts the block `id` on the line of `targetId`, on its `side`. Refused
 * (blocks unchanged) when that line is full or the target is the block.
 * The line's widths are shared equally again.
 */
export function placeBeside(
  blocks: Block[],
  id: string,
  targetId: string,
  side: "left" | "right",
): Block[] {
  if (id === targetId) return blocks;
  const moved = blocks.find((block) => block.id === id);
  const target = rowOf(blocks, targetId);
  if (!moved || !target) return blocks;
  const others = target.row.blocks.filter((block) => block.id !== id);
  if (others.length >= MAX_ROW_BLOCKS) return blocks;

  const rowId = target.row.blocks.length > 1 && target.row.id ? target.row.id : newId();
  const rest = blocks.filter((block) => block.id !== id);
  const at = rest.findIndex((block) => block.id === targetId) + (side === "right" ? 1 : 0);
  const next = [...rest.slice(0, at), moved, ...rest.slice(at)];
  const members = new Set([...others.map((block) => block.id), id]);
  const widths = equalWidths(members.size);
  let column = 0;
  return normalize(
    next.map((block) =>
      members.has(block.id)
        ? { ...block, row: rowId, width: widths[column++] ?? MIN_WIDTH }
        : block,
    ),
  );
}

/**
 * Takes the block `id` off its line: it goes right under the line, alone.
 * The other blocks of the line share its width.
 */
export function leaveRow(blocks: Block[], id: string): Block[] {
  const found = rowOf(blocks, id);
  const block = blocks.find((other) => other.id === id);
  if (!found || !block || found.row.blocks.length < 2) return blocks;
  const rest = blocks.filter((other) => other.id !== id);
  const lastOfRow = found.row.blocks.filter((other) => other.id !== id).at(-1);
  const at = rest.findIndex((other) => other.id === lastOfRow?.id) + 1;
  const stay = new Set(found.row.blocks.map((other) => other.id).filter((other) => other !== id));
  const widths = equalWidths(stay.size);
  let column = 0;
  const reshared = rest.map((other) =>
    stay.has(other.id) ? { ...other, width: widths[column++] ?? MIN_WIDTH } : other,
  );
  return normalize([...reshared.slice(0, at), alone(block), ...reshared.slice(at)]);
}

/** Moves the block `id` one place left (-1) or right (+1) on its line. */
export function moveInRow(blocks: Block[], id: string, step: -1 | 1): Block[] {
  const found = rowOf(blocks, id);
  if (!found || found.row.blocks.length < 2) return blocks;
  const from = blocks.findIndex((block) => block.id === id);
  const to = from + step;
  const other = blocks[to];
  if (!other || other.row !== found.row.id || !found.row.blocks.includes(other)) return blocks;
  const next = [...blocks];
  next[from] = other;
  next[to] = blocks[from] as Block;
  return next;
}

/**
 * Moves a whole line (the one holding the block `id`) one line up (-1) or
 * down (+1).
 */
export function moveRow(blocks: Block[], id: string, step: -1 | 1): Block[] {
  const all = rows(blocks);
  const index = all.findIndex((row) => row.blocks.some((block) => block.id === id));
  const to = index + step;
  if (index < 0 || to < 0 || to >= all.length) return blocks;
  const next = [...all];
  [next[index], next[to]] = [next[to] as Row, next[index] as Row];
  return next.flatMap((row) => row.blocks);
}

/**
 * Moves the block `id` (dragged onto `targetId`, outside its sides) before or
 * after the target's whole line, alone.
 */
export function moveToRow(blocks: Block[], id: string, targetId: string): Block[] {
  if (id === targetId) return blocks;
  const block = blocks.find((other) => other.id === id);
  const target = rowOf(blocks, targetId);
  if (!block || !target) return blocks;
  const fromRow = rowOf(blocks, id)?.index ?? 0;
  const below = fromRow < target.index;
  const rest = leaveRowIfAny(blocks, id).filter((other) => other.id !== id);
  const targetBlocks = rest.filter((other) =>
    target.row.blocks.some((member) => member.id === other.id),
  );
  const anchor = below ? targetBlocks.at(-1) : targetBlocks[0];
  const at = rest.findIndex((other) => other.id === anchor?.id) + (below ? 1 : 0);
  return normalize([...rest.slice(0, at), alone(block), ...rest.slice(at)]);
}

function leaveRowIfAny(blocks: Block[], id: string): Block[] {
  return (rowOf(blocks, id)?.row.blocks.length ?? 0) > 1 ? leaveRow(blocks, id) : blocks;
}

/**
 * Moves the border on the right of the column `id` by `delta` (a share of
 * the line): it and its right neighbour change width, snapped to
 * {@link WIDTH_STEP}, neither under {@link MIN_WIDTH}.
 */
export function resize(blocks: Block[], id: string, delta: number): Block[] {
  const found = rowOf(blocks, id);
  if (!found) return blocks;
  const members = found.row.blocks;
  const index = members.findIndex((block) => block.id === id);
  const left = members[index];
  const right = members[index + 1];
  if (!left || !right) return blocks;
  const pair = (left.width ?? 0) + (right.width ?? 0);
  const snapped = round(Math.round(((left.width ?? 0) + delta) / WIDTH_STEP) * WIDTH_STEP);
  const width = round(Math.min(Math.max(snapped, MIN_WIDTH), pair - MIN_WIDTH));
  if (width === left.width) return blocks;
  return blocks.map((block) =>
    block.id === left.id
      ? { ...block, width }
      : block.id === right.id
        ? { ...block, width: round(pair - width) }
        : block,
  );
}
