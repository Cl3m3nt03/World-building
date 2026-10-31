import { useEffect } from "react";

/**
 * Excalidraw reads the keyboard on its container, through React: with the
 * focus outside it (the page's buttons) or in the toolbar when the narrow
 * interface portals it there, Ctrl+Z and Ctrl+Y never reach it. They are
 * handed over here, as the other pages hear them on the window. What
 * Excalidraw handled stops before the window; fields and dialogs keep theirs.
 */
export function useHistoryKeys(container: HTMLElement | null) {
  useEffect(() => {
    if (!container) return;
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (!["z", "y"].includes(event.key.toLowerCase())) return;
      const target = event.target;
      if (target === container) return;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable) ||
        (target instanceof Element && target.closest("[role='dialog']"))
      ) {
        return;
      }
      container.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: event.key,
          code: event.code,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          shiftKey: event.shiftKey,
          bubbles: true,
          cancelable: true,
        }),
      );
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [container]);
}
