/**
 * Undo / redo of a map (M4 step 4.9): snapshots of its content. Changes
 * close together (typing a label, dragging a slider) make one step. Pure,
 * tested in history.test.ts.
 */

/** Most steps kept. */
export const HISTORY_LIMIT = 100;
/** Changes closer than this (ms) are one step. */
export const COALESCE_MS = 700;

export type History<T> = {
  past: T[];
  present: T;
  future: T[];
  /** When the last step was recorded. */
  lastAt: number;
};

export function startHistory<T>(present: T): History<T> {
  return { past: [], present, future: [], lastAt: Number.NEGATIVE_INFINITY };
}

/** `next` becomes the present; the change before it can be undone. */
export function record<T>(history: History<T>, next: T, now: number): History<T> {
  if (next === history.present) return history;
  const joins = now - history.lastAt < COALESCE_MS && history.past.length > 0;
  const past = joins ? history.past : [...history.past, history.present].slice(-HISTORY_LIMIT);
  return { past, present: next, future: [], lastAt: now };
}

export function undo<T>(history: History<T>): History<T> {
  const previous = history.past.at(-1);
  if (previous === undefined) return history;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
    lastAt: Number.NEGATIVE_INFINITY,
  };
}

export function redo<T>(history: History<T>): History<T> {
  const [next, ...future] = history.future;
  if (next === undefined) return history;
  return {
    past: [...history.past, history.present],
    present: next,
    future,
    lastAt: Number.NEGATIVE_INFINITY,
  };
}
