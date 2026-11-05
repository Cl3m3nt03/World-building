import { useEffect, useLayoutEffect } from "react";
import { useCurrentWorld } from "@/features/world";
import { fontQuery, themeHeadingFont, warmHeadingFonts } from "./headingFonts";

/**
 * Puts the open world's heading font on <html data-heading-font>, read by
 * src/styles/fonts.css. The attribute is set only once the font is loaded,
 * before the browser paints when it already is: the titles change font once,
 * never through a fallback (no layout shift). Alegreya, or no world, sets
 * nothing.
 */
export function useWorldHeadingFont(): void {
  const { data: world } = useCurrentWorld();
  const font = world ? themeHeadingFont(world.theme) : "alegreya";

  useEffect(warmHeadingFonts, []);

  useLayoutEffect(() => {
    if (font === "alegreya") return;
    const root = document.documentElement;
    let active = true;
    const apply = () => {
      if (active) root.dataset.headingFont = font;
    };
    const fonts = document.fonts as FontFaceSet | undefined;
    if (!fonts || fonts.check(fontQuery(font))) apply();
    else fonts.load(fontQuery(font)).then(apply, apply);
    return () => {
      active = false;
      delete root.dataset.headingFont;
    };
  }, [font]);
}
