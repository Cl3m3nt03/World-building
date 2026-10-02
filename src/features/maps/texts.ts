import type { MapContent, MapText } from "@/lib/bindings";
import { clamp01 } from "./pins";

/**
 * Texts of a map (M4 step 4.7, docs/features/03-map.md): a text at a point,
 * with its font, size, letter spacing, arc and whether it follows the zoom.
 * Pure functions, tested in texts.test.ts.
 */

export function newText(layerId: string, x: number, y: number, text: string): MapText {
  return {
    id: crypto.randomUUID(),
    layerId,
    x: clamp01(x),
    y: clamp01(y),
    text,
    style: { font: "serif", size: 28, spacing: 0, arc: 0, scaleWithZoom: true },
  };
}

export function addText(content: MapContent, text: MapText): MapContent {
  return { ...content, texts: [...content.texts, text] };
}

export function updateText(content: MapContent, id: string, patch: Partial<MapText>): MapContent {
  return {
    ...content,
    texts: content.texts.map((text) =>
      text.id === id
        ? {
            ...text,
            ...patch,
            x: clamp01(patch.x ?? text.x ?? 0),
            y: clamp01(patch.y ?? text.y ?? 0),
          }
        : text,
    ),
  };
}

export function removeText(content: MapContent, id: string): MapContent {
  return { ...content, texts: content.texts.filter((text) => text.id !== id) };
}

/** Size in px of a text on screen: its size, times the zoom if it follows it. */
export function shownSize(text: MapText, zoomScale: number): number {
  const size = text.style.size ?? 28;
  return text.style.scaleWithZoom ? size * zoomScale : size;
}

/**
 * Geometry of a text drawn on an arc: the box and the SVG path its letters
 * follow. `arc` goes from -1 (bent down) to 1 (bent up); 0 is straight.
 */
export function arcGeometry(text: MapText, size: number) {
  const letters = Math.max(text.text.length, 1);
  const spacing = text.style.spacing ?? 0;
  const width = Math.max(letters * size * (0.6 + spacing), size);
  const bend = (text.style.arc ?? 0) * width * 0.35;
  const top = Math.abs(bend) + size;
  const height = top + size * 0.5;
  // Baseline from left to right through the box's middle, bent by `bend`.
  const baseline = bend >= 0 ? top : top - Math.abs(bend);
  const path = `M 0 ${baseline} Q ${width / 2} ${baseline - 2 * bend} ${width} ${baseline}`;
  return { width, height, path };
}
