/** Durations offered for a writing session, in minutes. */
export const DURATIONS = [15, 25, 45, 60] as const;

/** Longest session chosen by hand, in minutes. */
export const MAX_MINUTES = 240;

/** A writing session: running, paused or over. Times in ms. */
export type Session =
  | { state: "running"; endsAt: number; startWords: number; total: number }
  | { state: "paused"; left: number; startWords: number; total: number }
  | { state: "over"; written: number };

export function start(minutes: number, words: number, now: number): Session {
  const total = Math.round(Math.min(Math.max(minutes, 1), MAX_MINUTES) * 60_000);
  return { state: "running", endsAt: now + total, startWords: words, total };
}

export function pause(session: Session, now: number): Session {
  return session.state === "running"
    ? {
        state: "paused",
        left: Math.max(0, session.endsAt - now),
        startWords: session.startWords,
        total: session.total,
      }
    : session;
}

export function resume(session: Session, now: number): Session {
  return session.state === "paused"
    ? {
        state: "running",
        endsAt: now + session.left,
        startWords: session.startWords,
        total: session.total,
      }
    : session;
}

/** Time left, in ms (0 once over). */
export function left(session: Session, now: number): number {
  if (session.state === "running") return Math.max(0, session.endsAt - now);
  if (session.state === "paused") return session.left;
  return 0;
}

/** The session at `now`: over when its time is up, with the words written. */
export function tick(session: Session, words: number, now: number): Session {
  if (session.state === "running" && now >= session.endsAt) {
    return { state: "over", written: Math.max(0, words - session.startWords) };
  }
  return session;
}

/** "12:05", or "1:02:05" past an hour. */
export function clock(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
