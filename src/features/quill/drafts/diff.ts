import type { JSONContent } from "@tiptap/react";

/** A piece of a compared paragraph: kept, or only on one side. */
export type Piece = { text: string; kind: "same" | "removed" | "added" };

/** A line of the comparison: the paragraph on the left and on the right. */
export type Row = { left: Piece[] | null; right: Piece[] | null };

/** Above this many cells, two paragraphs are compared as wholes, not word by word. */
const MAX_WORD_CELLS = 250_000;

function text(node: JSONContent): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "mention") return String(node.attrs?.label ?? "");
  if (node.type === "hardBreak") return "\n";
  return (node.content ?? []).map(text).join("");
}

/** The paragraphs of a draft (titles, quotes, list items…), as plain text. */
export function paragraphs(doc: JSONContent): string[] {
  const out: string[] = [];
  const walk = (node: JSONContent) => {
    const children = node.content ?? [];
    const leafBlock =
      children.length > 0 &&
      children.every(
        (child) => child.type === "text" || child.type === "mention" || child.type === "hardBreak",
      );
    if (leafBlock || node.type === "paragraph" || node.type === "heading") {
      const value = text(node).trim();
      if (value !== "") out.push(value);
      return;
    }
    if (node.type === "horizontalRule") {
      out.push("———");
      return;
    }
    for (const child of children) walk(child);
  };
  walk(doc);
  return out;
}

/**
 * Longest common subsequence of two lists: the pairs of indexes kept, in
 * order. Quadratic: callers keep the lists small.
 */
function lcs<T>(
  a: readonly T[],
  b: readonly T[],
  same: (x: T, y: T) => boolean,
): [number, number][] {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const table = new Uint32Array(rows * cols);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i * cols + j] = same(a[i] as T, b[j] as T)
        ? (table[(i + 1) * cols + j + 1] ?? 0) + 1
        : Math.max(table[(i + 1) * cols + j] ?? 0, table[i * cols + j + 1] ?? 0);
    }
  }
  const pairs: [number, number][] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (same(a[i] as T, b[j] as T)) {
      pairs.push([i, j]);
      i++;
      j++;
    } else if ((table[(i + 1) * cols + j] ?? 0) >= (table[i * cols + j + 1] ?? 0)) {
      i++;
    } else {
      j++;
    }
  }
  return pairs;
}

/** Merges neighbour pieces of the same kind. */
function joined(pieces: Piece[]): Piece[] {
  const out: Piece[] = [];
  for (const piece of pieces) {
    const last = out.at(-1);
    if (last && last.kind === piece.kind) last.text += piece.text;
    else out.push({ ...piece });
  }
  return out;
}

/** Two versions of a paragraph, word by word (spaces kept with their words). */
export function diffWords(before: string, after: string): { left: Piece[]; right: Piece[] } {
  const a = before.match(/\S+\s*/g) ?? [];
  const b = after.match(/\S+\s*/g) ?? [];
  if (a.length * b.length > MAX_WORD_CELLS) {
    return {
      left: [{ text: before, kind: "removed" }],
      right: [{ text: after, kind: "added" }],
    };
  }
  const pairs = lcs(a, b, (x, y) => x.trim() === y.trim());
  const left: Piece[] = [];
  const right: Piece[] = [];
  let i = 0;
  let j = 0;
  for (const [pi, pj] of [...pairs, [a.length, b.length] as [number, number]]) {
    for (; i < pi; i++) left.push({ text: a[i] as string, kind: "removed" });
    for (; j < pj; j++) right.push({ text: b[j] as string, kind: "added" });
    if (pi < a.length && pj < b.length) {
      left.push({ text: a[pi] as string, kind: "same" });
      right.push({ text: b[pj] as string, kind: "same" });
      i = pi + 1;
      j = pj + 1;
    }
  }
  return { left: joined(left), right: joined(right) };
}

/**
 * Two drafts side by side: equal paragraphs face each other; between them,
 * changed paragraphs are paired in order and compared word by word, and the
 * rest are only on one side.
 */
export function compareDrafts(before: string[], after: string[]): Row[] {
  const pairs = lcs(before, after, (x, y) => x === y);
  const rows: Row[] = [];
  let i = 0;
  let j = 0;
  for (const [pi, pj] of [...pairs, [before.length, after.length] as [number, number]]) {
    const removed = before.slice(i, pi);
    const added = after.slice(j, pj);
    for (let k = 0; k < Math.max(removed.length, added.length); k++) {
      const left = removed[k];
      const right = added[k];
      if (left !== undefined && right !== undefined) rows.push(diffWords(left, right));
      else if (left !== undefined)
        rows.push({ left: [{ text: left, kind: "removed" }], right: null });
      else if (right !== undefined)
        rows.push({ left: null, right: [{ text: right, kind: "added" }] });
    }
    if (pi < before.length && pj < after.length) {
      const same: Piece[] = [{ text: before[pi] as string, kind: "same" }];
      rows.push({ left: same, right: same });
    }
    i = pi + 1;
    j = pj + 1;
  }
  return rows;
}
