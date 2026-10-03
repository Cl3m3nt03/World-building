import type { CSSProperties } from "react";
import type { WikiPalette, WikiTheme } from "@/lib/bindings";

/**
 * The wiki's style (M8): a provided theme, maybe changed colour by colour,
 * and its fonts. It becomes CSS variables on the wiki's root (`--wiki-*`,
 * read by the `wiki-*` Tailwind colours), never on the app's tokens: the app
 * keeps its light or dark theme around the wiki.
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

/** The fonts' names, as shown in the font menus. */
export const FONT_NAMES: Record<WikiFontKey, string> = {
  inter: "Inter",
  cinzel: "Cinzel",
  playfair: "Playfair Display",
  garamond: "EB Garamond",
  lora: "Lora",
  "source-serif": "Source Serif",
};

export type WikiPreset = {
  palette: WikiPalette;
  headingFont: WikiFontKey;
  bodyFont: WikiFontKey;
};

/** The provided themes, by key; the first is the default. */
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

export type WikiPresetKey = keyof typeof WIKI_PRESETS;

const DEFAULT_PRESET: WikiPresetKey = "parchment";

function isPreset(key: string | undefined): key is WikiPresetKey {
  return key !== undefined && Object.hasOwn(WIKI_PRESETS, key);
}

function isFont(key: string | null | undefined): key is WikiFontKey {
  return typeof key === "string" && Object.hasOwn(WIKI_FONTS, key);
}

/** The theme as shown: an unknown preset or font falls back to the default's. */
export function resolveTheme(theme: WikiTheme): WikiPreset {
  const preset: WikiPreset = WIKI_PRESETS[presetKey(theme)];
  return {
    palette: theme.palette ?? preset.palette,
    headingFont: isFont(theme.headingFont) ? theme.headingFont : preset.headingFont,
    bodyFont: isFont(theme.bodyFont) ? theme.bodyFont : preset.bodyFont,
  };
}

/** The keys of the provided themes, in order. */
export const PRESET_KEYS = Object.keys(WIKI_PRESETS) as WikiPresetKey[];

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

/** Least contrast of the text and muted text on the background (WCAG AA). */
export const MIN_TEXT_CONTRAST = 4.5;

/**
 * Whether the wiki is light or dark, from its background: the app's tokens
 * under the wiki (type colours, controls) follow it, not the app's theme.
 */
export function themeScheme(theme: WikiTheme): "light" | "dark" {
  return luminance(resolveTheme(theme).palette.background) < 0.2 ? "dark" : "light";
}

/** The CSS variables of a theme, for the wiki's root. */
export function themeStyle(theme: WikiTheme): CSSProperties {
  const { palette, headingFont, bodyFont } = resolveTheme(theme);
  return {
    colorScheme: themeScheme(theme),
    "--wiki-background": palette.background,
    "--wiki-surface": palette.surface,
    "--wiki-text": palette.text,
    "--wiki-muted": palette.muted,
    "--wiki-accent": palette.accent,
    "--wiki-heading-font": WIKI_FONTS[headingFont],
    "--wiki-body-font": WIKI_FONTS[bodyFont],
  } as CSSProperties;
}
