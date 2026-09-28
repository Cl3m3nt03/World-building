import { useEffect, useRef } from "react";

/**
 * Edits waiting to be saved: text is saved a short time after the last
 * keystroke. Before the world or the window closes, they are sent and
 * awaited; a save sent once the world is closed would fail and the text
 * would be lost.
 */
type Flush = () => Promise<unknown> | undefined;

/** Sent by the Rust when the window is asked to close (src-tauri/src/closing.rs). */
export const BEFORE_CLOSE_EVENT = "bz://before-close";

const registered = new Set<{ current: Flush }>();

/**
 * Registers, while the component is mounted, how to save its pending edits
 * now. `flush` returns the save in progress (or nothing to wait for).
 */
export function usePendingSave(flush: Flush): void {
  const ref = useRef(flush);
  ref.current = flush;
  useEffect(() => {
    const entry = ref;
    registered.add(entry);
    return () => {
      registered.delete(entry);
    };
  }, []);
}

/**
 * Saves every pending edit now and waits for the saves (failed ones
 * included: their editor shows the error). Resolves after `timeoutMs` at
 * most, so a stuck save never blocks closing.
 */
export async function flushPendingSaves(timeoutMs = 5000): Promise<void> {
  const saves = [...registered].map((entry) => {
    try {
      return entry.current();
    } catch {
      return undefined;
    }
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    Promise.allSettled(saves),
    new Promise((resolve) => {
      timer = setTimeout(resolve, timeoutMs);
    }),
  ]);
  clearTimeout(timer);
}
