import cinzelLatinExt from "@fontsource-variable/cinzel/files/cinzel-latin-ext-wght-normal.woff2?url";
import cinzelLatin from "@fontsource-variable/cinzel/files/cinzel-latin-wght-normal.woff2?url";
import garamondLatinExt from "@fontsource-variable/eb-garamond/files/eb-garamond-latin-ext-wght-normal.woff2?url";
import garamondLatin from "@fontsource-variable/eb-garamond/files/eb-garamond-latin-wght-normal.woff2?url";
import interLatinExt from "@fontsource-variable/inter/files/inter-latin-ext-wght-normal.woff2?url";
import interLatin from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";
import loraLatinExt from "@fontsource-variable/lora/files/lora-latin-ext-wght-normal.woff2?url";
import loraLatin from "@fontsource-variable/lora/files/lora-latin-wght-normal.woff2?url";
import playfairLatinExt from "@fontsource-variable/playfair-display/files/playfair-display-latin-ext-wght-normal.woff2?url";
import playfairLatin from "@fontsource-variable/playfair-display/files/playfair-display-latin-wght-normal.woff2?url";
import sourceSerifLatinExt from "@fontsource-variable/source-serif-4/files/source-serif-4-latin-ext-wght-normal.woff2?url";
import sourceSerifLatin from "@fontsource-variable/source-serif-4/files/source-serif-4-latin-wght-normal.woff2?url";
import type { WikiFontKey } from "../theme";

/** The Latin subsets of the wiki's fonts, as the app ships them. */
const FILES: Record<WikiFontKey, { family: string; latin: string; latinExt: string }> = {
  inter: { family: "Inter Variable", latin: interLatin, latinExt: interLatinExt },
  cinzel: { family: "Cinzel Variable", latin: cinzelLatin, latinExt: cinzelLatinExt },
  playfair: {
    family: "Playfair Display Variable",
    latin: playfairLatin,
    latinExt: playfairLatinExt,
  },
  garamond: { family: "EB Garamond Variable", latin: garamondLatin, latinExt: garamondLatinExt },
  lora: { family: "Lora Variable", latin: loraLatin, latinExt: loraLatinExt },
  "source-serif": {
    family: "Source Serif 4 Variable",
    latin: sourceSerifLatin,
    latinExt: sourceSerifLatinExt,
  },
};

// The characters of each subset (as in Fontsource's own CSS).
const LATIN =
  "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";
const LATIN_EXT =
  "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF";

function base64(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let binary = "";
  // By chunks: one call per byte would be slow, one for all would overflow.
  for (let at = 0; at < view.length; at += 0x8000) {
    binary += String.fromCharCode(...view.subarray(at, at + 0x8000));
  }
  return btoa(binary);
}

async function fontFace(family: string, url: string, range: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`font not found: ${url}`);
  const data = base64(await response.arrayBuffer());
  return `@font-face {
  font-family: "${family}";
  font-style: normal;
  font-display: swap;
  font-weight: 100 900;
  src: url(data:font/woff2;base64,${data}) format("woff2");
  unicode-range: ${range};
}`;
}

/**
 * `fonts.css` of the exported site: the fonts the wiki uses, inside the CSS
 * itself, so the site needs no network and no extra file.
 */
export async function fontsCss(keys: WikiFontKey[]): Promise<string> {
  const faces: string[] = [];
  for (const key of new Set(keys)) {
    const { family, latin, latinExt } = FILES[key];
    faces.push(await fontFace(family, latin, LATIN), await fontFace(family, latinExt, LATIN_EXT));
  }
  return `/* Fonts under the SIL Open Font License, shipped with BuilderZ. */\n${faces.join("\n")}\n`;
}
