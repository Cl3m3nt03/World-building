import { useEffect, useState } from "react";
import { useResolvedTheme } from "@/app/theme";

/**
 * The veil over the world's image, computed per image (ADR 0003 and 0012):
 * text set straight on the backdrop stays ≥ 4.5:1 (WCAG AA) whatever the
 * image. The image is measured once on a small canvas, its samples cached by
 * URL, and the veil's opacity is the lowest that keeps every sample readable
 * under the backdrop's text colours, never below the theme's own veil.
 */

export type Rgb = readonly [number, number, number];

/** AA for body text, plus a margin for the atlas engraved over the veil. */
export const VEIL_TARGET_CONTRAST = 4.7;

/** Side of the canvas the image is measured on (its blur makes this enough). */
const SAMPLE_SIZE = 48;
const MAX_CACHED = 24;

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of an sRGB colour. */
export function luminance([r, g, b]: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(a: number, b: number): number {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Lowest contrast between the texts and the samples once veiled at `alpha`. */
function worstContrast(samples: ArrayLike<number>, veil: Rgb, texts: number[], alpha: number) {
  let worst = Number.POSITIVE_INFINITY;
  for (let i = 0; i + 2 < samples.length; i += 3) {
    const mixed: Rgb = [
      alpha * veil[0] + (1 - alpha) * samples[i],
      alpha * veil[1] + (1 - alpha) * samples[i + 1],
      alpha * veil[2] + (1 - alpha) * samples[i + 2],
    ];
    const background = luminance(mixed);
    for (const text of texts) worst = Math.min(worst, contrast(text, background));
  }
  return worst;
}

/**
 * Opacity of the veil over `samples` (RGB triplets) so that every text colour
 * reaches `target`, at least `floor`. Without samples (an image that cannot be
 * measured), the worst image is assumed: the colour opposite the veil.
 */
export function veilAlpha(
  samples: ArrayLike<number> | null,
  veil: Rgb,
  texts: Rgb[],
  floor: number,
  target = VEIL_TARGET_CONTRAST,
): number {
  const opposite = luminance(veil) < 0.5 ? 255 : 0;
  const pixels = samples && samples.length >= 3 ? samples : [opposite, opposite, opposite];
  const textLuminances = texts.map(luminance);
  const passes = (alpha: number) => worstContrast(pixels, veil, textLuminances, alpha) >= target;
  if (passes(floor)) return floor;
  let low = floor;
  let high = 1;
  for (let step = 0; step < 14; step += 1) {
    const middle = (low + high) / 2;
    if (passes(middle)) high = middle;
    else low = middle;
  }
  return Math.ceil(high * 100) / 100;
}

const samplesCache = new Map<string, Promise<Uint8ClampedArray | null>>();

/** The image's colours on a small canvas, or `null` if it cannot be read. */
function measure(url: string): Promise<Uint8ClampedArray | null> {
  const cached = samplesCache.get(url);
  if (cached) return cached;
  const promise = new Promise<Uint8ClampedArray | null>((resolve) => {
    const image = new Image();
    // Read back from a canvas: the image's scheme sends CORS headers.
    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = SAMPLE_SIZE;
        canvas.height = SAMPLE_SIZE;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return resolve(null);
        context.imageSmoothingQuality = "high";
        context.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
        const rgba = context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data;
        const rgb = new Uint8ClampedArray((rgba.length / 4) * 3);
        for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
          rgb[j] = rgba[i];
          rgb[j + 1] = rgba[i + 1];
          rgb[j + 2] = rgba[i + 2];
        }
        resolve(rgb);
      } catch {
        resolve(null); // A tainted canvas: the worst case is assumed.
      }
    };
    image.onerror = () => resolve(null);
    image.src = url;
  });
  if (samplesCache.size >= MAX_CACHED) {
    const oldest = samplesCache.keys().next().value;
    if (oldest !== undefined) samplesCache.delete(oldest);
  }
  samplesCache.set(url, promise);
  return promise;
}

/** A computed CSS colour as RGB (any syntax the browser accepts). */
function parseColor(value: string): Rgb | null {
  const text = value.trim();
  const triplet = /^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)$/.exec(text);
  if (triplet) return [Number(triplet[1]), Number(triplet[2]), Number(triplet[3])];
  const hex = /^#([0-9a-f]{6})$/i.exec(text);
  if (hex) {
    const n = Number.parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgb = /^rgba?\(\s*(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)/i.exec(text);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  return null;
}

/** The theme's veil colour, its floor and the colours of bare backdrop text. */
function readTokens(): { veil: Rgb; floor: number; texts: Rgb[] } | null {
  const style = getComputedStyle(document.documentElement);
  const veil = parseColor(style.getPropertyValue("--bz-backdrop-veil"));
  const floor = Number.parseFloat(style.getPropertyValue("--bz-backdrop-veil-floor"));
  const texts = ["--bz-on-backdrop", "--bz-text"]
    .map((name) => parseColor(style.getPropertyValue(name)))
    .filter((color): color is Rgb => color !== null);
  if (!veil || Number.isNaN(floor) || texts.length === 0) return null;
  return { veil, floor, texts };
}

/**
 * The veil over the backdrop image `url` in the current theme, as a CSS
 * colour; `undefined` without an image (the token's veil applies).
 */
export function useBackdropVeil(url: string | undefined): string | undefined {
  const theme = useResolvedTheme();
  const [veil, setVeil] = useState<{ key: string; color: string } | null>(null);
  const key = `${theme}|${url}`;
  useEffect(() => {
    if (!url) return;
    let live = true;
    const tokens = readTokens();
    if (!tokens) return;
    const color = (samples: Uint8ClampedArray | null) => {
      const alpha = veilAlpha(samples, tokens.veil, tokens.texts, tokens.floor);
      return `rgb(${tokens.veil.join(" ")} / ${alpha})`;
    };
    measure(url).then((samples) => {
      if (live) setVeil({ key, color: color(samples) });
    });
    return () => {
      live = false;
    };
  }, [url, key]);
  if (!url) return undefined;
  // Until the image is measured, the veil of the worst image: never too light.
  if (veil?.key === key) return veil.color;
  const tokens = typeof document === "undefined" ? null : readTokens();
  return tokens
    ? `rgb(${tokens.veil.join(" ")} / ${veilAlpha(null, tokens.veil, tokens.texts, tokens.floor)})`
    : undefined;
}
