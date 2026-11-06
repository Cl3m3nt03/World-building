import type { TranslationKey } from "@/i18n";
import type { HeadingFont, Material, Ornament, WorldTheme } from "@/lib/bindings";
import type { Mode } from "./accent";
import blossom from "./illustrations/blossom.svg";
import crypt from "./illustrations/crypt.svg";
import dawn from "./illustrations/dawn.svg";
import dunes from "./illustrations/dunes.svg";
import embers from "./illustrations/embers.svg";
import forest from "./illustrations/forest.svg";
import grimoire from "./illustrations/grimoire.svg";
import night from "./illustrations/night.svg";
import peaks from "./illustrations/peaks.svg";
import sea from "./illustrations/sea.svg";
import station from "./illustrations/station.svg";

/**
 * A theme's accent: one color, of which each mode gets a readable variant
 * (see accent.ts), or one color per mode, each still made readable.
 */
export type ThemeAccent = string | Readonly<Record<Mode, string>>;

/** The accent of `accent` given for `mode`, before it is made readable. */
export function accentOf(accent: ThemeAccent, mode: Mode): string {
  return typeof accent === "string" ? accent : accent[mode];
}

/**
 * The look of an ambiance (ADR 0015 §2): set by the shipped theme itself,
 * never written in world.json. Its mode follows the app (§3).
 */
export type PresetLook = {
  material: Material;
  ornament: Ornament;
  headingFont: HeadingFont;
};

/**
 * A theme shipped with BuilderZ. The illustrations were drawn for BuilderZ
 * (generated SVG, original work of the project, ADR 0003).
 */
export type ThemePreset = {
  id: string;
  name: TranslationKey;
  /** URL of the illustration, bundled with the app. */
  image: string;
  accent: ThemeAccent;
  /** An ambiance's material, ornament and heading font; none: Vélin, no ornament, Alegreya. */
  look?: PresetLook;
};

export const PRESETS: readonly ThemePreset[] = [
  { id: "dawn", name: "worldTheme.preset.dawn", image: dawn, accent: "#e39b4a" },
  { id: "forest", name: "worldTheme.preset.forest", image: forest, accent: "#8bc97a" },
  { id: "sea", name: "worldTheme.preset.sea", image: sea, accent: "#5fcdc0" },
  { id: "embers", name: "worldTheme.preset.embers", image: embers, accent: "#f07178" },
  { id: "night", name: "worldTheme.preset.night", image: night, accent: "#b39af5" },
  { id: "peaks", name: "worldTheme.preset.peaks", image: peaks, accent: "#7aa7f5" },
  { id: "dunes", name: "worldTheme.preset.dunes", image: dunes, accent: "#e6b450" },
  { id: "blossom", name: "worldTheme.preset.blossom", image: blossom, accent: "#ef8fc4" },
  // The three ambiances of the mock-ups approved on 2026-11-05: one accent per
  // mode, the deep one for light mode, so that it also reads as text there.
  {
    id: "grimoire",
    name: "worldTheme.preset.grimoire",
    image: grimoire,
    accent: { light: "#7a5414", dark: "#d9b25c" },
    look: { material: "parchment", ornament: "rules", headingFont: "cinzel" },
  },
  {
    id: "station",
    name: "worldTheme.preset.station",
    image: station,
    accent: { light: "#006b85", dark: "#4fd6f0" },
    look: { material: "coldGlass", ornament: "marks", headingFont: "oxanium" },
  },
  {
    id: "crypt",
    name: "worldTheme.preset.crypt",
    image: crypt,
    accent: { light: "#8c1a1c", dark: "#d0393f" },
    look: { material: "stone", ornament: "edge", headingFont: "playfair" },
  },
];

/** The default accent (ochre, ADR 0003), dark reference. */
export const DEFAULT_ACCENT = "#c8912e";

/** Accent colors offered for a custom theme, before the free color. */
export const ACCENT_SWATCHES: readonly { color: string; name: TranslationKey }[] = [
  { color: DEFAULT_ACCENT, name: "worldTheme.color.ochre" },
  { color: "#e6b450", name: "worldTheme.color.amber" },
  { color: "#f29a5c", name: "worldTheme.color.orange" },
  { color: "#f07178", name: "worldTheme.color.red" },
  { color: "#ef8fc4", name: "worldTheme.color.pink" },
  { color: "#b39af5", name: "worldTheme.color.violet" },
  { color: "#7aa7f5", name: "worldTheme.color.blue" },
  { color: "#5fcdc0", name: "worldTheme.color.teal" },
  { color: "#8bc97a", name: "worldTheme.color.green" },
  { color: "#a3abbd", name: "worldTheme.color.slate" },
];

export function findPreset(id: string): ThemePreset | undefined {
  return PRESETS.find((preset) => preset.id === id);
}

/** What a theme shows: its background and accent. */
export type ResolvedTheme = {
  /** The illustration of a shipped theme (URL). */
  presetImage: string | null;
  /** The asset shown as background: a custom one, else the main image. */
  backgroundAsset: string | null;
  /** `null`: the default accent of each mode. */
  accent: ThemeAccent | null;
};

/**
 * The background and accent of `theme`. A shipped theme this app does not
 * know (saved by a newer app) shows as the default theme.
 */
export function resolveTheme(theme: WorldTheme, mainImage: string | null): ResolvedTheme {
  if (theme.kind === "preset") {
    const preset = findPreset(theme.id);
    if (preset) return { presetImage: preset.image, backgroundAsset: null, accent: preset.accent };
  }
  if (theme.kind === "custom") {
    return {
      presetImage: null,
      backgroundAsset: theme.background ?? mainImage,
      accent: theme.accent,
    };
  }
  return { presetImage: null, backgroundAsset: mainImage, accent: null };
}
