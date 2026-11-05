import type { HeadingFont, WorldTheme } from "@/lib/bindings";
import { findPreset } from "./presets";

/**
 * The heading fonts a world's theme can pick (ADR 0015), by the key
 * `world.json` stores, with the family each is declared under in
 * src/styles/fonts.css. All are SIL OFL, shipped with the app.
 */
export const HEADING_FONTS: Record<HeadingFont, string> = {
  alegreya: "Alegreya Variable",
  cinzel: "Cinzel Variable",
  ebGaramond: "EB Garamond Variable",
  playfair: "Playfair Display Variable",
  oxanium: "Oxanium Variable",
};

/** Their names, as cited in Réglages › À propos. */
export const HEADING_FONT_NAMES: Record<HeadingFont, string> = {
  alegreya: "Alegreya",
  cinzel: "Cinzel",
  ebGaramond: "EB Garamond",
  playfair: "Playfair Display",
  oxanium: "Oxanium",
};

function isHeadingFont(value: unknown): value is HeadingFont {
  return typeof value === "string" && Object.hasOwn(HEADING_FONTS, value);
}

/**
 * The heading font of `theme`: the custom one's, or a shipped ambiance's
 * (Cinzel, Oxanium, Playfair Display), else Alegreya. A font this app does
 * not know (saved by a newer one) shows as Alegreya.
 */
export function themeHeadingFont(theme: WorldTheme): HeadingFont {
  if (theme.kind === "preset") return findPreset(theme.id)?.look?.headingFont ?? "alegreya";
  if (theme.kind !== "custom") return "alegreya";
  return isHeadingFont(theme.headingFont) ? theme.headingFont : "alegreya";
}

/** The CSS font shorthand that makes the browser load `font`'s Latin faces. */
export function fontQuery(font: HeadingFont): string {
  return `700 1em "${HEADING_FONTS[font]}"`;
}

/**
 * Starts loading every heading font, so that opening a world later finds its
 * font ready (local files, a few tens of KB each).
 */
export function warmHeadingFonts(): void {
  const fonts = typeof document === "undefined" ? undefined : document.fonts;
  if (!fonts) return;
  for (const font of Object.keys(HEADING_FONTS) as HeadingFont[])
    fonts.load(fontQuery(font)).catch(() => undefined);
}

/** How long a world waits for its heading font before showing anyway. */
const LOAD_TIMEOUT_MS = 300;

/**
 * Resolves once `font` is loaded (at once if it is, or Alegreya), and after
 * LOAD_TIMEOUT_MS at most: the world's route waits on it, so that its first
 * frame is already in its font. Never rejects.
 */
export async function loadHeadingFont(font: HeadingFont): Promise<void> {
  const fonts = typeof document === "undefined" ? undefined : document.fonts;
  if (font === "alegreya" || !fonts || fonts.check(fontQuery(font))) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    fonts.load(fontQuery(font)).catch(() => undefined),
    new Promise((resolve) => {
      timer = setTimeout(resolve, LOAD_TIMEOUT_MS);
    }),
  ]);
  clearTimeout(timer);
}
