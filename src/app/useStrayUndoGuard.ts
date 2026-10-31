import { useEffect } from "react";

/** Whether `target` keeps its own undo history: a field, or a text editor. */
function isEditable(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest("input, textarea, select, [contenteditable='true']") !== null
  );
}

/**
 * The webview keeps one undo stack per page: outside a text field, Ctrl+Z
 * would quietly undo the last edit of a field out of sight, which then saves.
 * Text editing has its own history, and the pages with an undo of their own
 * (Map, Tree, Timeline, Canvas) listen below the window, so this runs last.
 */
export function useStrayUndoGuard() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (!["z", "y"].includes(event.key.toLowerCase())) return;
      if (!isEditable(event.target)) event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
