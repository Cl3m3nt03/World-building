import type { CSSProperties } from "react";
import { themeHeadingFont, themeLook, resolveTheme as worldTheme } from "@/features/world-theme";
import { contrast as accentContrast, type Mode, mix } from "@/features/world-theme/accent";
import { grounds, MATERIAL_COLORS, materialAccent } from "@/features/world-theme/materials";
import type { HeadingFont, WikiPalette, WikiTheme, WorldTheme } from "@/lib/bindings";

/**
 * The wiki's style (M8): a provided theme, maybe changed colour by colour,
 * and its fonts. It becomes CSS variables on the wiki's root (`--wiki-*`,
 * read by the `wiki-*` Tailwind colours), never on the app's tokens: the app
 * keeps its light or dark theme around the wiki. The Atlas theme (the
 * default, ADR 0015 §8) has no colours of its own: it takes the world's theme
 * and the mode shown (`WikiLook`).
 */

/**
 * Fonts the wiki can use, by key (the keys are what the settings store).
 * All are free (SIL Open Font License) and shipped with the app (`fonts.css`):
 * they work offline and in the exported site.
 */
export const WIKI_FONTS = {
  inter: '"Inter Variable", ui-sans-serif, system-ui, sans-serif',
  cinzel: '"Cinzel Variable", Georgia, serif',
  playfair: '"Playfair Display Variable", Georgia, serif',
  garamond: '"EB Garamond Variable", Georgia, serif',
  lora: '"Lora Variable", Georgia, serif',
  "source-serif": '"Source Serif 4 Variable", Georgia, serif',
} as const satisfies Record<string, string>;

export type WikiFontKey = keyof typeof WIKI_FONTS;

/**
 * The wiki's fonts: the ones above (Quill uses them too), and the app's own
 * that the Atlas theme takes from the world (Alegreya, Alegreya Sans and the
 * world themes' Oxanium, declared in src/styles), offered in the wiki only.
 */
export const SITE_FONTS = {
  ...WIKI_FONTS,
  alegreya: '"Alegreya Variable", "Alegreya", Georgia, serif',
  "alegreya-sans": '"Alegreya Sans", ui-sans-serif, system-ui, sans-serif',
  oxanium: '"Oxanium Variable", ui-sans-serif, system-ui, sans-serif',
} as const satisfies Record<string, string>;

export type SiteFontKey = keyof typeof SITE_FONTS;

/** The fonts' names, as shown in the font menus. */
export const FONT_NAMES: Record<SiteFontKey, string> = {
  inter: "Inter",
  cinzel: "Cinzel",
  playfair: "Playfair Display",
  garamond: "EB Garamond",
  lora: "Lora",
  "source-serif": "Source Serif",
  alegreya: "Alegreya",
  "alegreya-sans": "Alegreya Sans",
  oxanium: "Oxanium",
};

export type WikiPreset = {
  palette: WikiPalette;
  headingFont: SiteFontKey;
  bodyFont: SiteFontKey;
};

/**
 * What the Atlas theme follows: the world's theme (its material, accent and
 * heading font) and the mode shown. Without a world or a mode (a test, an
 * export with no context), Vélin in light.
 */
export type WikiLook = { world: WorldTheme | null; mode: Mode };

export const DEFAULT_LOOK: WikiLook = { world: null, mode: "light" };

/** The world heading fonts (ADR 0015) as wiki fonts. */
const HEADING_TO_SITE: Record<HeadingFont, SiteFontKey> = {
  alegreya: "alegreya",
  cinzel: "cinzel",
  ebGaramond: "garamond",
  playfair: "playfair",
  oxanium: "oxanium",
};

/** Least contrast of the text and muted text on the background (WCAG AA). */
export const MIN_TEXT_CONTRAST = 4.5;

/** `hex` darkened (light) or lightened (dark) until it reads at 4.5:1 on every ground. */
function readableOn(hex: string, mode: Mode, on: readonly string[]): string {
  const target: [number, number, number] = mode === "light" ? [0, 0, 0] : [255, 255, 255];
  for (let step = 0; step <= 20; step++) {
    const candidate = mix(hex, target, step / 20);
    if (on.every((ground) => accentContrast(candidate, ground) >= MIN_TEXT_CONTRAST))
      return candidate;
  }
  return mode === "light" ? "#000000" : "#ffffff";
}

/**
 * The Atlas theme for `look`: the world's material in the mode shown (its
 * page background, surface and text), the world's accent as that material
 * shows it, made readable as text (it writes the links), the world's heading
 * font, and the app's running text (Alegreya Sans).
 */
export function atlasPreset(look: WikiLook): WikiPreset {
  const material = look.world ? themeLook(look.world).material : "vellum";
  const colors = MATERIAL_COLORS[material][look.mode];
  const [background, surface] = grounds(colors);
  const accent = look.world ? worldTheme(look.world, null).accent : null;
  const shown = materialAccent(accent, material, look.mode).accent;
  return {
    palette: {
      background,
      surface,
      text: colors.text,
      muted: colors.textMuted,
      accent: readableOn(shown, look.mode, [background, surface]),
    },
    headingFont: HEADING_TO_SITE[look.world ? themeHeadingFont(look.world) : "alegreya"],
    bodyFont: "alegreya-sans",
  };
}

/** The provided themes with colours of their own, by key (Atlas comes first). */
export const WIKI_PRESETS = {
  parchment: {
    palette: {
      background: "#f4efe1",
      surface: "#fbf8ef",
      text: "#2a2722",
      muted: "#655f52",
      accent: "#1f5f57",
    },
    headingFont: "playfair",
    bodyFont: "inter",
  },
  night: {
    palette: {
      background: "#14161f",
      surface: "#1e2130",
      text: "#ebe6d9",
      muted: "#aaa597",
      accent: "#d9b26a",
    },
    headingFont: "cinzel",
    bodyFont: "lora",
  },
  forest: {
    palette: {
      background: "#ecf1e8",
      surface: "#f7faf4",
      text: "#1e2a21",
      muted: "#525f55",
      accent: "#2d6843",
    },
    headingFont: "garamond",
    bodyFont: "source-serif",
  },
  ink: {
    palette: {
      background: "#ffffff",
      surface: "#f5f5f3",
      text: "#1b1b1b",
      muted: "#5c5c5c",
      accent: "#8c2a2a",
    },
    headingFont: "inter",
    bodyFont: "inter",
  },
  dusk: {
    palette: {
      background: "#1b1726",
      surface: "#262036",
      text: "#ede9f5",
      muted: "#aca5bf",
      accent: "#c9a0ea",
    },
    headingFont: "cinzel",
    bodyFont: "inter",
  },
} as const satisfies Record<string, WikiPreset>;

export type WikiPresetKey = "atlas" | keyof typeof WIKI_PRESETS;

/** The default of every wiki without a theme of its own (ADR 0015 §8). */
const DEFAULT_PRESET: WikiPresetKey = "atlas";

function isPreset(key: string | undefined): key is WikiPresetKey {
  return key === "atlas" || (key !== undefined && Object.hasOwn(WIKI_PRESETS, key));
}

function isFont(key: string | null | undefined): key is SiteFontKey {
  return typeof key === "string" && Object.hasOwn(SITE_FONTS, key);
}

/** A provided theme as shown with `look` (only Atlas depends on it). */
export function presetOf(key: WikiPresetKey, look: WikiLook = DEFAULT_LOOK): WikiPreset {
  return key === "atlas" ? atlasPreset(look) : WIKI_PRESETS[key];
}

/**
 * The theme as shown with `look`: an unknown preset (saved by a newer app)
 * or font falls back to the default's.
 */
export function resolveTheme(theme: WikiTheme, look: WikiLook = DEFAULT_LOOK): WikiPreset {
  const preset = presetOf(presetKey(theme), look);
  return {
    palette: theme.palette ?? preset.palette,
    headingFont: isFont(theme.headingFont) ? theme.headingFont : preset.headingFont,
    bodyFont: isFont(theme.bodyFont) ? theme.bodyFont : preset.bodyFont,
  };
}

/** The keys of the provided themes, in order. */
export const PRESET_KEYS: WikiPresetKey[] = [
  "atlas",
  ...(Object.keys(WIKI_PRESETS) as (keyof typeof WIKI_PRESETS)[]),
];

/** The key of the theme's preset (an unknown one: the default). */
export function presetKey(theme: WikiTheme): WikiPresetKey {
  return isPreset(theme.preset) ? theme.preset : DEFAULT_PRESET;
}

/** Relative luminance of a `#rrggbb` colour (WCAG), from 0 to 1. */
export function luminance(hex: string): number {
  const channel = (at: number) => {
    const value = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** Contrast ratio of two `#rrggbb` colours (WCAG), from 1 to 21. */
export function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

/**
 * Whether the wiki is light or dark, from its background: the app's tokens
 * under the wiki (type colours, controls) and its popovers follow it, not
 * the app's theme. Atlas, unchanged, is always in the mode shown.
 */
export function themeScheme(theme: WikiTheme, look: WikiLook = DEFAULT_LOOK): Mode {
  return luminance(resolveTheme(theme, look).palette.background) < 0.2 ? "dark" : "light";
}

/** The CSS variables of a theme, for the wiki's root. */
export function themeStyle(theme: WikiTheme, look: WikiLook = DEFAULT_LOOK): CSSProperties {
  const { palette, headingFont, bodyFont } = resolveTheme(theme, look);
  return {
    colorScheme: themeScheme(theme, look),
    "--wiki-background": palette.background,
    "--wiki-surface": palette.surface,
    "--wiki-text": palette.text,
    "--wiki-muted": palette.muted,
    "--wiki-accent": palette.accent,
    "--wiki-heading-font": SITE_FONTS[headingFont],
    "--wiki-body-font": SITE_FONTS[bodyFont],
  } as CSSProperties;
}
