import { expect, test } from "vitest";
import type { AudioCue } from "@/lib/bindings";
import { arrive, lineDuration, placeCues, wordsOf } from "./schedule";

const cue = (
  id: string,
  kind: AudioCue["kind"],
  assetId: string | null = `${id}.wav`,
): AudioCue => ({
  id,
  draftId: "d",
  kind,
  assetId,
  volume: 80,
  looped: kind === "ambience",
  createdAt: "",
  updatedAt: "",
});

test("a line lasts as long as its words take to read, and never too little", () => {
  expect(lineDuration(0, 200)).toBe(1200);
  expect(lineDuration(2, 200)).toBe(1500);
  expect(lineDuration(100, 200)).toBe(30_000);
  expect(wordsOf("  Il   pleuvait fort. ")).toBe(3);
});

test("effects play on their first line; ambiences cover their section", () => {
  const placed = placeCues(
    [cue("rain", "ambience"), cue("bell", "effect"), cue("lost", "effect", null)],
    [
      { cueId: "rain", text: "", first: 1, last: 2 },
      { cueId: "bell", text: "", first: 2, last: 2 },
      { cueId: "lost", text: "", first: 0, last: 0 },
      { cueId: "gone", text: "", first: 3, last: 3 },
    ],
  );
  // A sound without its file, or without a sound, does not play.
  expect(placed.map((item) => item.cue.id)).toEqual(["rain", "bell"]);

  expect(arrive(0, placed, new Set())).toEqual({ effects: [], start: [], stop: [] });
  const one = arrive(1, placed, new Set());
  expect(one.start.map((item) => item.cue.id)).toEqual(["rain"]);
  const two = arrive(2, placed, new Set(["rain"]));
  expect(two.effects.map((item) => item.cue.id)).toEqual(["bell"]);
  expect(two.start).toEqual([]);
  expect(arrive(3, placed, new Set(["rain"])).stop).toEqual(["rain"]);
  // Jumping into the middle of a section starts its ambience.
  expect(arrive(2, placed, new Set()).start.map((item) => item.cue.id)).toEqual(["rain"]);
});
