import { assetUrl } from "@/lib/assets";

/**
 * Images of a canvas (M7 step 7.9, docs/features/06-canvas.md): an image
 * is an asset of the world; the scene keeps only its id (the element's
 * `fileId`), and its bytes are read from the media library when the canvas
 * opens, for Excalidraw only (never saved in the scene).
 */

/** Longest side of an image placed from the media library, in scene units. */
export const MAX_PLACED_SIDE = 480;

/** The size an image is placed at: its own, made to fit `MAX_PLACED_SIDE`. */
export function placedSize(width: number, height: number): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: MAX_PLACED_SIDE, height: MAX_PLACED_SIDE };
  const scale = Math.min(1, MAX_PLACED_SIDE / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** The image elements whose bytes Excalidraw does not have yet. */
export function missingFiles(
  elements: readonly { type: string; isDeleted?: boolean; fileId?: string | null }[],
  loaded: ReadonlySet<string>,
): string[] {
  const ids = new Set<string>();
  for (const element of elements) {
    if (element.type !== "image" || element.isDeleted || !element.fileId) continue;
    if (!loaded.has(element.fileId)) ids.add(element.fileId);
  }
  return [...ids];
}

/** An asset's bytes, as Excalidraw wants them (a data URL), with their type. */
export async function readAsset(assetId: string): Promise<{ dataURL: string; mimeType: string }> {
  const response = await fetch(assetUrl(assetId));
  if (!response.ok) throw new Error(`asset ${assetId}: ${response.status}`);
  const blob = await response.blob();
  const dataURL = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  return { dataURL, mimeType: blob.type };
}

/** The natural size of an image given as a data URL. */
export function naturalSize(dataURL: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve({ width: 0, height: 0 });
    image.src = dataURL;
  });
}
