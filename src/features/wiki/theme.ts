import type { CSSProperties } from "react";
import type { WikiPalette, WikiTheme } from "@/lib/bindings";

/**
 * The wiki's style (M8): a provided theme, maybe changed colour by colour,
 * and its fonts. It becomes CSS variables on the wiki's root (`--wiki-*`,
 * read by the `wiki-*` Tailwind colours), never on the app's tokens: the app
 * keeps its light or dark theme around the wiki.
 */

/** Fonts the wiki can use, by key (the keys are what the settings store). */
export const WIKI_FONTS = {
  serif: 'Georgia, "Times New Roman", serif',
  sans: '"Inter Variable", ui-sans-serif, system-ui, sans-serif',
} as const satisfies Record<string, string>;

export type WikiFontKey = keyof typeof WIKI_FONTS;

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
    headingFont: "serif",
    bodyFont: "sans",
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
  const preset: WikiPreset = WIKI_PRESETS[isPreset(theme.preset) ? theme.preset : DEFAULT_PRESET];
  return {
    palette: theme.palette ?? preset.palette,
    headingFont: isFont(theme.headingFont) ? theme.headingFont : preset.headingFont,
    bodyFont: isFont(theme.bodyFont) ? theme.bodyFont : preset.bodyFont,
  };
}

/** Relative luminance of a `#rrggbb` colour (WCAG), from 0 to 1. */
export function luminance(hex: string): number {
  const channel = (at: number) => {
    const value = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

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
