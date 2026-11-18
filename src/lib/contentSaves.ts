/**
 * Saves of a document's text (a card's blocks, a Quill draft), and what the
 * cache holds around them (#586).
 *
 * An editor saves what was typed when it is left (see pendingSaves.ts), and
 * the next page may open the same document at once, before that save is
 * done. So:
 * - the text is put in the cache as its save starts, for the next editor to
 *   start from;
 * - a failed save puts back the last text known to be saved, but only if no
 *   save of the document started after it: a later one holds newer text
 *   (sequence numbers, not a comparison of contents, which two saves of the
 *   same text would share);
 * - a load waits for the saves in progress (a refetch sent while a save is
 *   on its way could read the old text, then put it in the cache over the
 *   new one), and is read again if a save started while it was reading.
 *
 * The saves of one document must run one after the other, in the order they
 * were sent (a mutation `scope`), so that the latest started is the latest
 * written.
 */

/** Longest wait of a load for the saves in progress, like `flushPendingSaves`. */
export const SAVE_WAIT_MS = 5000;

/** Where a document's text is cached, as the save sees it. */
export type ContentCache<T> = {
  /** The text in the cache now, if any. */
  read: () => T | undefined;
  /** Puts `text` in the cache. */
  write: (text: T) => void;
  /** Nothing known to put back: reads the document again. */
  reload: () => void;
};

type Entry = {
  /** Saves not settled yet. */
  pending: Set<Promise<unknown>>;
  /** Saves started; the number of the latest. */
  started: number;
  /** Loads reading now. */
  reading: number;
  /** The last text known to be saved, while saves are in progress. */
  confirmed: { text: unknown } | null;
};

/**
 * One entry per document while it is being saved or read, removed after:
 * nothing stays for a document left alone (the counter of a load that
 * reads holds its entry until it is done).
 */
const entries = new Map<string, Entry>();

function entry(documentId: string): Entry {
  let found = entries.get(documentId);
  if (!found) {
    found = { pending: new Set(), started: 0, reading: 0, confirmed: null };
    entries.set(documentId, found);
  }
  return found;
}

function prune(documentId: string, found: Entry) {
  if (found.pending.size === 0 && found.reading === 0 && entries.get(documentId) === found) {
    entries.delete(documentId);
  }
}

/**
 * Saves `text` with `send`: in the cache at once, put back to the last
 * saved text if this save fails and is still the latest, confirmed in the
 * cache if it succeeds as the latest. Returns the save.
 */
export function saveContent<T, R>(
  documentId: string,
  text: T,
  cache: ContentCache<T>,
  send: () => Promise<R>,
): Promise<R> {
  const found = entry(documentId);
  // No save in progress: the cache holds what was loaded or saved last.
  if (found.pending.size === 0) {
    const current = cache.read();
    found.confirmed = current === undefined ? null : { text: current };
  }
  found.started += 1;
  const number = found.started;
  cache.write(text);
  const save = send();
  found.pending.add(save);
  const latest = () => found.started === number;
  save.then(
    () => {
      found.confirmed = { text };
      if (latest()) cache.write(text);
      found.pending.delete(save);
      prune(documentId, found);
    },
    () => {
      if (latest()) {
        if (found.confirmed) cache.write(found.confirmed.text as T);
        else cache.reload();
      }
      found.pending.delete(save);
      prune(documentId, found);
    },
  );
  return save;
}

/**
 * Reads `documentId` with `load` once no save of it is in progress, or
 * after `SAVE_WAIT_MS` at most (a stuck save never leaves a page blank).
 */
export async function loadAfterSaves<T>(
  documentId: string,
  load: () => Promise<T>,
  waitMs = SAVE_WAIT_MS,
): Promise<T> {
  const found = entry(documentId);
  found.reading += 1;
  const deadline = Date.now() + waitMs;
  try {
    for (;;) {
      const left = deadline - Date.now();
      if (found.pending.size > 0 && left > 0) {
        let timer: ReturnType<typeof setTimeout> | undefined;
        await Promise.race([
          Promise.allSettled([...found.pending]),
          new Promise((resolve) => {
            timer = setTimeout(resolve, left);
          }),
        ]);
        clearTimeout(timer);
        continue;
      }
      const before = found.started;
      const value = await load();
      // A save started while reading: read again (after it, or the deadline).
      if (found.started === before || deadline - Date.now() <= 0) return value;
    }
  } finally {
    found.reading -= 1;
    prune(documentId, found);
  }
}

/** Whether anything is kept for `documentId` (for the tests). */
export function isTracked(documentId: string): boolean {
  return entries.has(documentId);
}
