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
 * From a field, a step of that stack can still belong to another field: the
 * step is refused, so a field only ever undoes its own text.
 */
export function useStrayUndoGuard() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (!["z", "y"].includes(event.key.toLowerCase())) return;
      if (!isEditable(event.target)) event.preventDefault();
    };
    const onBeforeInput = (event: InputEvent) => {
      if (!event.inputType.startsWith("history")) return;
      const focused = document.activeElement;
      if (!(event.target instanceof Node && focused?.contains(event.target))) {
        event.preventDefault();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    // Before the text editors, which may stop it.
    window.addEventListener("beforeinput", onBeforeInput, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("beforeinput", onBeforeInput, true);
    };
  }, []);
}
