import type { Material, Ornament } from "@/lib/bindings";
import { accentFor, foregroundOn, type Mode, mix } from "./accent";
import { accentOf, type ThemeAccent } from "./presets";

/**
 * The colours of each material that its text and accent are read on
 * (src/styles/materials.css, Vélin in tokens.css): the page background and
 * the two surfaces, `rgb(r g b / a)` laid on that background. A test checks
 * they match the CSS.
 */
export type MaterialColors = {
  bg: string;
  surface: string;
  surfaceStrong: string;
  text: string;
  textMuted: string;
  /** Accent when the theme gives none (`--bz-accent` fallback). */
  accent: string;
};

export const MATERIALS: readonly Material[] = ["vellum", "parchment", "coldGlass", "stone"];
export const ORNAMENTS: readonly Ornament[] = ["none", "rules", "marks", "edge"];

export const MATERIAL_COLORS: Record<Material, Record<Mode, MaterialColors>> = {
  vellum: {
    light: {
      bg: "#f2e9d4",
      surface: "rgb(250 245 232 / 0.78)",
      surfaceStrong: "rgb(251 247 237 / 0.95)",
      text: "#2b2219",
      textMuted: "#6e604c",
      accent: "#7d5e1e",
    },
    dark: {
      bg: "#13110d",
      surface: "rgb(26 22 16 / 0.72)",
      surfaceStrong: "rgb(22 19 14 / 0.94)",
      text: "#eee4cf",
      textMuted: "#a89d86",
      accent: "#d4ad5a",
    },
  },
  parchment: {
    light: {
      bg: "#ecdcb8",
      surface: "rgb(244 232 203 / 0.95)",
      surfaceStrong: "rgb(247 237 212 / 0.98)",
      text: "#2a1c0e",
      textMuted: "#634c2c",
      accent: "#7a5414",
    },
    dark: {
      bg: "#160f08",
      surface: "rgb(38 28 16 / 0.95)",
      surfaceStrong: "rgb(44 33 19 / 0.98)",
      text: "#f1e3c2",
      textMuted: "#bda67a",
      accent: "#d9b25c",
    },
  },
  coldGlass: {
    light: {
      bg: "#e3ebf1",
      surface: "rgb(238 245 250 / 0.72)",
      surfaceStrong: "rgb(243 248 252 / 0.94)",
      text: "#0e1924",
      textMuted: "#445666",
      accent: "#006b85",
    },
    dark: {
      bg: "#060b11",
      surface: "rgb(12 22 32 / 0.62)",
      surfaceStrong: "rgb(14 25 37 / 0.92)",
      text: "#dcebf5",
      textMuted: "#8ea7ba",
      accent: "#4fd6f0",
    },
  },
  stone: {
    light: {
      bg: "#d6d2cb",
      surface: "rgb(224 220 213 / 0.97)",
      surfaceStrong: "rgb(230 226 220 / 0.99)",
      text: "#1a1615",
      textMuted: "#4f4643",
      accent: "#7d5e1e",
    },
    dark: {
      bg: "#0a0808",
      surface: "rgb(23 20 19 / 0.97)",
      surfaceStrong: "rgb(28 24 23 / 0.99)",
      text: "#e7ddd6",
      textMuted: "#a3958e",
      accent: "#d4ad5a",
    },
  },
};

/** `rgb(r g b / a)` laid on the opaque `background` (`#rrggbb`). */
export function composite(color: string, background: string): string {
  const match = /^rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\)$/.exec(color);
  if (!match) return color;
  const [, r, g, b, a] = match.map(Number) as [number, number, number, number, number];
  return mix(background, [r, g, b], a);
}

/** The three colours text and accent sit on: background, surface, strong surface. */
export function grounds(colors: MaterialColors): [string, string, string] {
  return [
    colors.bg,
    composite(colors.surface, colors.bg),
    composite(colors.surfaceStrong, colors.bg),
  ];
}

/**
 * The accent (`null`: the material's own) as shown on `material` in `mode`,
 * readable on its grounds (see `accentFor`), and the text drawn on it.
 */
export function materialAccent(
  accent: ThemeAccent | null,
  material: Material,
  mode: Mode,
): { accent: string; foreground: string } {
  const colors = MATERIAL_COLORS[material][mode];
  const shown = accentFor(accent ? accentOf(accent, mode) : colors.accent, mode, grounds(colors));
  return { accent: shown, foreground: foregroundOn(shown) };
}
