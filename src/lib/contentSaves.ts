/**
 * Saves of a document's text in progress, by document (a card's blocks, a
 * Quill draft), so that a load never reads the text from before them
 * (#586).
 *
 * An editor saves what was typed when it is left (see pendingSaves.ts), and
 * the next page may load the same document at once: a refetch sent while
 * the save is on its way could read the old text, then put it in the cache
 * over the new one. A load waits for the saves in progress, and is read
 * again if a save started while it was reading.
 */

/** Saves not finished yet, by document. */
const inProgress = new Map<string, Set<Promise<unknown>>>();
/** Saves ever started, by document: a load compares it before and after reading. */
const started = new Map<string, number>();

/** Notes `save` (just sent) as in progress for `documentId` until it settles. */
export function trackSave<T>(documentId: string, save: Promise<T>): Promise<T> {
  started.set(documentId, (started.get(documentId) ?? 0) + 1);
  const saves = inProgress.get(documentId) ?? new Set<Promise<unknown>>();
  inProgress.set(documentId, saves);
  saves.add(save);
  const done = () => {
    saves.delete(save);
    if (saves.size === 0 && inProgress.get(documentId) === saves) inProgress.delete(documentId);
  };
  save.then(done, done);
  return save;
}

/** Reads `documentId` with `load` once no save of it is in progress. */
export async function loadAfterSaves<T>(documentId: string, load: () => Promise<T>): Promise<T> {
  for (;;) {
    const saves = inProgress.get(documentId);
    if (saves && saves.size > 0) {
      await Promise.allSettled([...saves]);
      continue;
    }
    const before = started.get(documentId) ?? 0;
    const value = await load();
    if ((started.get(documentId) ?? 0) === before) return value;
  }
}
