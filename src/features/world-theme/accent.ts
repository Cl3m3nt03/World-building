/**
 * Accent colors of world themes. A theme gives one color; each mode (light,
 * dark) gets a variant readable on its background, the way the default
 * ochre has one per mode (ADR 0003).
 */

export type Mode = "light" | "dark";

/**
 * What the accent is read on in each mode with the Vélin material: the page
 * background (`--bz-bg`) and the two surfaces laid on it (tokens.css; a test
 * checks them against materials.ts). Other materials pass their own.
 */
export const VELLUM_GROUNDS: Record<Mode, readonly string[]> = {
  light: ["#f2e9d4", "#f8f2e4", "#fbf6ec"],
  dark: ["#13110d", "#18150f", "#16130e"],
};

/**
 * Smallest contrast between the accent and what it sits on: 3:1, the WCAG
 * level for interface components (buttons, focus rings), met by the default
 * accents. Text drawn on the accent gets 4.5:1.
 */
export const MIN_CONTRAST = 3;
export const MIN_TEXT_CONTRAST = 4.5;

/** `#rrggbb` (any case). */
export function isHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}

export type Rgb = [number, number, number];

function toRgb(hex: string): Rgb {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
}

function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colors (1 to 21). */
export function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

/** `hex` moved toward `target` by `amount` (0 to 1). */
export function mix(hex: string, target: Rgb, amount: number): string {
  const rgb = toRgb(hex);
  return toHex(rgb.map((c, i) => c + ((target[i] ?? c) - c) * amount) as Rgb);
}

/**
 * `hex` as it is shown in `mode`: unchanged if readable on every ground of
 * that mode (≥ 3:1, and its text ≥ 4.5:1), else darkened (light mode) or
 * lightened (dark mode) just enough.
 */
export function accentFor(
  hex: string,
  mode: Mode,
  grounds: readonly string[] = VELLUM_GROUNDS[mode],
): string {
  const color = hex.toLowerCase();
  const target: Rgb = mode === "light" ? [0, 0, 0] : [255, 255, 255];
  for (let step = 0; step <= 20; step++) {
    const candidate = mix(color, target, step / 20);
    const onGrounds = grounds.every((ground) => contrast(candidate, ground) >= MIN_CONTRAST);
    if (onGrounds && contrast(foregroundOn(candidate), candidate) >= MIN_TEXT_CONTRAST) {
      return candidate;
    }
  }
  return mode === "light" ? "#000000" : "#ffffff";
}

/** Text drawn on the accent (buttons): near-black or near-white, the more readable. */
export function foregroundOn(accent: string): string {
  const dark = "#1a1206";
  const light = "#fffaf0";
  return contrast(accent, dark) >= contrast(accent, light) ? dark : light;
}
