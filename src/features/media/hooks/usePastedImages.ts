import { useEffect } from "react";

const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/bmp": "bmp",
};

export type PastedImage = { extension: string; data: number[] };

/** Images pasted anywhere in the window (Ctrl+V), except into text fields. */
export function usePastedImages(onPaste: (image: PastedImage) => void) {
  useEffect(() => {
    const handle = (event: ClipboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      for (const item of Array.from(event.clipboardData?.items ?? [])) {
        const extension = EXTENSIONS[item.type];
        const file = extension ? item.getAsFile() : null;
        if (!extension || !file) continue;
        event.preventDefault();
        void file.arrayBuffer().then((buffer) => {
          onPaste({ extension, data: Array.from(new Uint8Array(buffer)) });
        });
      }
    };
    window.addEventListener("paste", handle);
    return () => window.removeEventListener("paste", handle);
  }, [onPaste]);
}
