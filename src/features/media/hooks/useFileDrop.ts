import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useEffect, useState } from "react";

/**
 * Files dropped on the window (Tauri drag-and-drop event, which gives real
 * paths). Returns whether files are being dragged over the window.
 */
export function useFileDrop(onDrop: (paths: string[]) => void): boolean {
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let disposed = false;

    let webview: ReturnType<typeof getCurrentWebview>;
    try {
      webview = getCurrentWebview();
    } catch (error) {
      // Outside Tauri (tests, plain browser) there is no webview to listen to.
      console.warn("Drag and drop unavailable", error);
      return;
    }

    webview
      .onDragDropEvent(({ payload }) => {
        if (payload.type === "enter" || payload.type === "over") {
          setHovering(true);
          return;
        }
        setHovering(false);
        if (payload.type === "drop" && payload.paths.length > 0) onDrop(payload.paths);
      })
      .then((stop) => {
        if (disposed) stop();
        else unlisten = stop;
      })
      .catch((error: unknown) => console.warn("Drag and drop unavailable", error));

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [onDrop]);

  return hovering;
}
