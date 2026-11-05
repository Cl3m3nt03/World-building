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

/** AA for body text (4.5:1), plus a little for the sampling of the image. */
export const VEIL_TARGET_CONTRAST = 4.6;

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

/** What lies over the image: the veil, then the atlas engraved on it. */
export type VeilLayers = {
  /** Colour of the veil. */
  veil: Rgb;
  /** The theme's own opacity of the veil, never gone below. */
  floor: number;
  /** Colours of the text set straight on the backdrop. */
  texts: Rgb[];
  /** The atlas's strongest ink and its opacity over an image. */
  ink?: { color: Rgb; alpha: number } | undefined;
};

const mix = (alpha: number, top: Rgb, bottom: Rgb): Rgb => [
  alpha * top[0] + (1 - alpha) * bottom[0],
  alpha * top[1] + (1 - alpha) * bottom[1],
  alpha * top[2] + (1 - alpha) * bottom[2],
];

/** Lowest contrast between the texts and the samples once veiled at `alpha`. */
function worstContrast(samples: ArrayLike<number>, layers: VeilLayers, alpha: number) {
  const texts = layers.texts.map(luminance);
  let worst = Number.POSITIVE_INFINITY;
  for (let i = 0; i + 2 < samples.length; i += 3) {
    const pixel: Rgb = [samples[i] ?? 0, samples[i + 1] ?? 0, samples[i + 2] ?? 0];
    const veiled = mix(alpha, layers.veil, pixel);
    // Text may cross an engraved line: the line counts as background too.
    const backgrounds = layers.ink
      ? [veiled, mix(layers.ink.alpha, layers.ink.color, veiled)]
      : [veiled];
    for (const background of backgrounds) {
      const level = luminance(background);
      for (const text of texts) worst = Math.min(worst, contrast(text, level));
    }
  }
  return worst;
}

/**
 * Opacity of the veil over `samples` (RGB triplets) so that every text colour
 * reaches `target`, at least the layers' floor. Without samples (an image
 * that cannot be measured), the worst image is assumed: the colour opposite
 * the veil.
 */
export function veilAlpha(
  samples: ArrayLike<number> | null,
  layers: VeilLayers,
  target = VEIL_TARGET_CONTRAST,
): number {
  const opposite = luminance(layers.veil) < 0.5 ? 255 : 0;
  const pixels = samples && samples.length >= 3 ? samples : [opposite, opposite, opposite];
  const passes = (alpha: number) => worstContrast(pixels, layers, alpha) >= target;
  if (passes(layers.floor)) return layers.floor;
  let low = layers.floor;
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
          rgb[j] = rgba[i] ?? 0;
          rgb[j + 1] = rgba[i + 1] ?? 0;
          rgb[j + 2] = rgba[i + 2] ?? 0;
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

/**
 * A computed CSS colour as RGB and opacity: hex (the minified build turns
 * `rgb(… / a)` into `#rrggbbaa`), `rgb()` or a bare `r g b` triplet.
 */
export function parseColor(value: string): { rgb: Rgb; alpha: number } | null {
  const text = value.trim();
  const hex = /^#([0-9a-f]{3,8})$/i.exec(text)?.[1];
  if (hex) {
    const digits = hex.length <= 4 ? [...hex].map((d) => d + d) : (hex.match(/../g) ?? []);
    const [r, g, b, a] = digits.map((pair) => Number.parseInt(pair, 16));
    if (r === undefined || g === undefined || b === undefined || hex.length % 4 === 1) return null;
    return { rgb: [r, g, b], alpha: a === undefined ? 1 : a / 255 };
  }
  const numbers = text.match(/\d*\.?\d+/g)?.map(Number) ?? [];
  const [r, g, b, alpha = 1] = numbers;
  if (r === undefined || g === undefined || b === undefined) return null;
  return { rgb: [r, g, b], alpha };
}

/** The layers over a backdrop image of the theme `element` shows, from tokens.css. */
function readLayers(element: Element = document.documentElement): VeilLayers | null {
  const style = getComputedStyle(element);
  const token = (name: string) => style.getPropertyValue(name);
  const veil = parseColor(token("--bz-backdrop-veil"))?.rgb;
  const floor = Number.parseFloat(token("--bz-backdrop-veil-floor"));
  const texts = ["--bz-on-backdrop", "--bz-text"].flatMap((name) => {
    const color = parseColor(token(name));
    return color ? [color.rgb] : [];
  });
  if (!veil || Number.isNaN(floor) || texts.length === 0) return null;
  const ink = parseColor(token("--bz-atlas-ink-strong"));
  const overImage = Number.parseFloat(token("--bz-atlas-over-image"));
  return {
    veil,
    floor,
    texts,
    ink:
      ink && !Number.isNaN(overImage)
        ? { color: ink.rgb, alpha: ink.alpha * overImage }
        : undefined,
  };
}

const veilColor = (layers: VeilLayers, samples: Uint8ClampedArray | null) =>
  `rgb(${layers.veil.join(" ")} / ${veilAlpha(samples, layers)})`;

/**
 * The veil over the backdrop image `url` in the current theme, as a CSS
 * colour; `undefined` without an image (the token's veil applies).
 * `scope` computes it for a subtree that shows another theme instead (the
 * theme gallery's preview): its element, once mounted, and a key that
 * changes with the theme it shows.
 */
export function useBackdropVeil(
  url: string | undefined,
  scope?: { element: Element | null; key: string },
): string | undefined {
  const theme = useResolvedTheme();
  const [veil, setVeil] = useState<{ key: string; color: string } | null>(null);
  const key = `${scope ? scope.key : theme}|${url}`;
  const element = scope ? scope.element : document.documentElement;
  useEffect(() => {
    if (!url || !element) return;
    const layers = readLayers(element);
    if (!layers) return;
    let live = true;
    measure(url).then((samples) => {
      if (live) setVeil({ key, color: veilColor(layers, samples) });
    });
    return () => {
      live = false;
    };
  }, [url, key, element]);
  if (!url || !element) return undefined;
  if (veil?.key === key) return veil.color;
  // Until the image is measured, the veil of the worst image: never too light.
  const layers = readLayers(element);
  return layers ? veilColor(layers, null) : undefined;
}
