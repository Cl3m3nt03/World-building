import { expect, test } from "vitest";
import {
  leaveRow,
  MAX_ROW_BLOCKS,
  moveInRow,
  moveRow,
  moveToRow,
  normalize,
  placeBeside,
  resize,
  rows,
} from "./layout";
import type { Block } from "./model";

function text(id: string, row?: string, width?: number): Block {
  const block: Block = { id, type: "text", doc: { type: "doc" } };
  if (row !== undefined) block.row = row;
  if (width !== undefined) block.width = width;
  return block;
}

/** The lines as ids: `["a", "b|c"]` is a alone, then b and c side by side. */
function lines(blocks: Block[]): string[] {
  return rows(blocks).map((row) => row.blocks.map((block) => block.id).join("|"));
}

function widths(blocks: Block[]): (number | undefined)[] {
  return blocks.map((block) => block.width);
}

test("neighbours with the same row id share a line, three at most", () => {
  const blocks = [
    text("a"),
    text("b", "r", 0.5),
    text("c", "r", 0.5),
    text("d"),
    text("e", "s"),
    text("f", "s"),
    text("g", "s"),
    text("h", "s"),
  ];
  expect(lines(blocks)).toEqual(["a", "b|c", "d", "e|f|g", "h"]);
  expect(MAX_ROW_BLOCKS).toBe(3);
});

test("normalize drops the place of a block alone and fixes unusable widths", () => {
  const blocks = normalize([
    text("a", "lonely", 0.5),
    text("b", "r", 0.7),
    text("c", "r", 0.7),
    text("d", "s", 0.3),
    text("e", "s", 0.7),
  ]);
  expect(blocks[0]).toEqual(text("a"));
  expect(widths(blocks)).toEqual([undefined, 0.5, 0.5, 0.3, 0.7]);
});

test("a block placed beside another makes a line, then joins it", () => {
  const two = placeBeside([text("a"), text("b"), text("c")], "b", "a", "right");
  expect(lines(two)).toEqual(["a|b", "c"]);
  expect(widths(two)).toEqual([0.5, 0.5, undefined]);

  const three = placeBeside(two, "c", "a", "left");
  expect(lines(three)).toEqual(["c|a|b"]);
  expect(widths(three)).toEqual([0.33, 0.33, 0.34]);
});

test("a full line refuses a fourth block", () => {
  const full = placeBeside(
    placeBeside([text("a"), text("b"), text("c"), text("d")], "b", "a", "right"),
    "c",
    "b",
    "right",
  );
  expect(lines(full)).toEqual(["a|b|c", "d"]);
  expect(placeBeside(full, "d", "c", "right")).toBe(full);
  // Moving within the full line is still possible.
  expect(lines(placeBeside(full, "a", "c", "right"))).toEqual(["b|c|a", "d"]);
});

test("leaving a line puts the block right under it, alone", () => {
  const row = placeBeside(
    placeBeside([text("a"), text("b"), text("c")], "b", "a", "right"),
    "c",
    "b",
    "right",
  );
  const left = leaveRow(row, "a");
  expect(lines(left)).toEqual(["b|c", "a"]);
  expect(widths(left)).toEqual([0.5, 0.5, undefined]);
  // The last block of a two-block line leaving it leaves no line.
  expect(lines(leaveRow(left, "c"))).toEqual(["b", "c", "a"]);
  expect(leaveRow(left, "b").every((block) => block.row === undefined)).toBe(true);
});

test("blocks move left and right on their line, and lines move up and down", () => {
  const blocks = [text("a"), text("b", "r", 0.3), text("c", "r", 0.7), text("d")];
  expect(lines(moveInRow(blocks, "c", -1))).toEqual(["a", "c|b", "d"]);
  expect(moveInRow(blocks, "b", -1)).toBe(blocks);
  expect(lines(moveRow(blocks, "c", -1))).toEqual(["b|c", "a", "d"]);
  expect(lines(moveRow(blocks, "a", 1))).toEqual(["b|c", "a", "d"]);
  expect(moveRow(blocks, "d", 1)).toBe(blocks);
});

test("a block dropped on a line goes before or after the whole line", () => {
  const blocks = [text("a"), text("b", "r", 0.5), text("c", "r", 0.5), text("d")];
  expect(lines(moveToRow(blocks, "a", "c"))).toEqual(["b|c", "a", "d"]);
  expect(lines(moveToRow(blocks, "d", "b"))).toEqual(["a", "d", "b|c"]);
  // A block of a line dropped elsewhere leaves its line.
  expect(lines(moveToRow(blocks, "b", "d"))).toEqual(["a", "c", "d", "b"]);
});

test("resizing snaps to 10 % and keeps both columns at least 20 %", () => {
  const blocks = [text("a", "r", 0.5), text("b", "r", 0.5)];
  expect(widths(resize(blocks, "a", 0.1))).toEqual([0.6, 0.4]);
  expect(resize(blocks, "a", 0.04)).toBe(blocks);
  expect(widths(resize(blocks, "a", -0.9))).toEqual([0.2, 0.8]);
  expect(widths(resize(blocks, "a", 0.9))).toEqual([0.8, 0.2]);
  // The last column has no border on its right.
  expect(resize(blocks, "b", 0.1)).toBe(blocks);
});
