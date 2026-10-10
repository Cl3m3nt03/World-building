import { assetUrl } from "@/lib/assets";
import type { BookStyle, Cover } from "@/lib/bindings";
import { drawCover } from "./coverArt";
import { coverFontReady } from "./useCoverImage";

/** Size of the exported cover, in pixels (2:3, as the book). */
const WIDTH = 1200;
const HEIGHT = 1800;

/**
 * The cover of a story as a PNG (base64, without its `data:` prefix), drawn
 * as the book shows it: for the exports' first page (ADR 0010).
 */
export async function coverPng(story: {
  title: string;
  bookStyle: BookStyle;
  cover: Cover;
}): Promise<string> {
  await coverFontReady();
  let image: { source: ImageBitmap; width: number; height: number } | null = null;
  if (story.cover.assetId) {
    try {
      const response = await fetch(assetUrl(story.cover.assetId));
      if (response.ok) {
        const bitmap = await createImageBitmap(await response.blob());
        image = { source: bitmap, width: bitmap.width, height: bitmap.height };
      }
    } catch {
      // The cover without its illustration.
    }
  }
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("no 2D canvas");
  drawCover(context, WIDTH, HEIGHT, { ...story, image });
  image?.source.close();
  return canvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
}
