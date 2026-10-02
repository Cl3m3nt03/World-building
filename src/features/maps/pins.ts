import type { MapContent, MapPin } from "@/lib/bindings";

/**
 * Pins of a map (M4 step 4.5, docs/features/03-map.md). Positions are
 * relative to the image (0 to 1). Pure functions, tested in pins.test.ts.
 */

/** Pin sizes offered, as a scale of the default size. */
export const PIN_SIZES = [0.75, 1, 1.5, 2, 3] as const;
/** Default look of a plain marker. */
export const DEFAULT_PIN = { icon: "map-pin", color: "red" } as const;
/** Step of a pin moved with the arrow keys, as a share of the image. */
export const KEYBOARD_STEP = 0.005;

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** A new pin on `layerId` at `x`, `y`: tied to `cardId`, or a plain marker. */
export function newPin(
  layerId: string,
  x: number,
  y: number,
  cardId: string | null = null,
  label = "",
): MapPin {
  return {
    id: crypto.randomUUID(),
    layerId,
    cardId,
    x: clamp01(x),
    y: clamp01(y),
    icon: DEFAULT_PIN.icon,
    color: DEFAULT_PIN.color,
    label,
    size: 1,
  };
}

export function addPin(content: MapContent, pin: MapPin): MapContent {
  return { ...content, pins: [...content.pins, pin] };
}

export function updatePin(content: MapContent, id: string, patch: Partial<MapPin>): MapContent {
  return {
    ...content,
    pins: content.pins.map((pin) =>
      pin.id === id
        ? {
            ...pin,
            ...patch,
            x: clamp01(patch.x ?? pin.x ?? 0),
            y: clamp01(patch.y ?? pin.y ?? 0),
          }
        : pin,
    ),
  };
}

export function removePin(content: MapContent, id: string): MapContent {
  return { ...content, pins: content.pins.filter((pin) => pin.id !== id) };
}

/** The pin moved by `dx`, `dy` steps of {@link KEYBOARD_STEP} (arrow keys). */
export function nudgePin(content: MapContent, id: string, dx: number, dy: number): MapContent {
  const pin = content.pins.find((other) => other.id === id);
  if (!pin) return content;
  return updatePin(content, id, {
    x: (pin.x ?? 0) + dx * KEYBOARD_STEP,
    y: (pin.y ?? 0) + dy * KEYBOARD_STEP,
  });
}
