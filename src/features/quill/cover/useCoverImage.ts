import { useEffect, useState } from "react";
import { assetUrl } from "@/lib/assets";

export type LoadedImage = { source: ImageBitmap; width: number; height: number };

/**
 * A cover's illustration, decoded for a canvas: read as bytes, so that the
 * canvas stays readable (a WebGL texture, a PNG for the exports).
 */
export function useCoverImage(assetId: string | null): LoadedImage | null {
  const [loaded, setLoaded] = useState<{ id: string; image: LoadedImage } | null>(null);
  useEffect(() => {
    if (!assetId) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(assetUrl(assetId));
        if (!response.ok) return;
        const image = await createImageBitmap(await response.blob());
        if (cancelled) {
          image.close();
          return;
        }
        setLoaded({
          id: assetId,
          image: { source: image, width: image.width, height: image.height },
        });
      } catch {
        // No illustration: the cover shows the book's colour only.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [assetId]);
  return assetId && loaded?.id === assetId ? loaded.image : null;
}

/** Waits for the cover font, so that the title is not drawn in a fallback. */
export async function coverFontReady(): Promise<void> {
  try {
    await document.fonts.load('700 40px "Playfair Display Variable"');
  } catch {
    // Drawn with the fallback font.
  }
}
