import type { AudioCue } from "@/lib/bindings";
import type { CueSpan } from "../audio/cueMark";

/** The shortest time a line stays, in ms (a title, a short line). */
const MIN_LINE_MS = 1500;

/** The time on a line without words (a divider, an image, an empty line). */
const EMPTY_LINE_MS = 1200;

/** How long the reading stays on a line of `words` words, at `wordsPerMinute`. */
export function lineDuration(words: number, wordsPerMinute: number): number {
  if (words === 0) return EMPTY_LINE_MS;
  return Math.max(MIN_LINE_MS, Math.round((words / wordsPerMinute) * 60_000));
}

/** The words of a line of text. */
export function wordsOf(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** A sound and where it plays: from its first line to its last. */
export type PlacedCue = { cue: AudioCue; first: number; last: number };

/** The sounds of a text with their lines (a sound without passage does not play). */
export function placeCues(cues: AudioCue[], spans: CueSpan[]): PlacedCue[] {
  return spans.flatMap((span) => {
    const cue = cues.find((candidate) => candidate.id === span.cueId);
    return cue?.assetId ? [{ cue, first: span.first, last: span.last }] : [];
  });
}

/** What the sound does when the reading comes to a line. */
export type Change = {
  /** Effects to play once: their passage starts on this line. */
  effects: PlacedCue[];
  /** Ambiences to start (fading in): this line is in their section. */
  start: PlacedCue[];
  /** Ambiences to stop (fading out): this line is out of their section. */
  stop: string[];
};

/**
 * The change of sound when the reading comes to line `line`, the ambiences
 * `playing` (ids) being heard: ambiences are those whose section holds the
 * line, effects those whose passage starts on it.
 */
export function arrive(line: number, placed: PlacedCue[], playing: Set<string>): Change {
  const ambiences = placed.filter((item) => item.cue.kind === "ambience");
  const wanted = ambiences.filter((item) => item.first <= line && line <= item.last);
  return {
    effects: placed.filter((item) => item.cue.kind === "effect" && item.first === line),
    start: wanted.filter((item) => !playing.has(item.cue.id)),
    stop: [...playing].filter((id) => !wanted.some((item) => item.cue.id === id)),
  };
}
