/**
 * Undo / redo of a map (M4 step 4.9): snapshots of its content. Changes of
 * the same field close together (typing a label, dragging a slider: the
 * same `group`) make one step; any other change is a step of its own. Pure,
 * tested in history.test.ts.
 */

/** Most steps kept. */
export const HISTORY_LIMIT = 100;
/** Changes of the same group closer than this (ms) are one step. */
export const COALESCE_MS = 700;

export type History<T> = {
  past: T[];
  present: T;
  future: T[];
  /** When the last step was recorded, and its group. */
  lastAt: number;
  lastGroup: string | null;
};

export function startHistory<T>(present: T): History<T> {
  return { past: [], present, future: [], lastAt: Number.NEGATIVE_INFINITY, lastGroup: null };
}

/**
 * `next` becomes the present; the change before it can be undone. A change
 * of the same `group` as the previous one, soon after it, joins its step.
 */
export function record<T>(
  history: History<T>,
  next: T,
  now: number,
  group: string | null = null,
): History<T> {
  if (next === history.present) return history;
  const joins =
    group !== null &&
    group === history.lastGroup &&
    now - history.lastAt < COALESCE_MS &&
    history.past.length > 0;
  const past = joins ? history.past : [...history.past, history.present].slice(-HISTORY_LIMIT);
  return { past, present: next, future: [], lastAt: now, lastGroup: group };
}

export function undo<T>(history: History<T>): History<T> {
  const previous = history.past.at(-1);
  if (previous === undefined) return history;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
    lastAt: Number.NEGATIVE_INFINITY,
    lastGroup: null,
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
    lastGroup: null,
  };
}
