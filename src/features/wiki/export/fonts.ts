import alegreyaSans400Latin from "@fontsource/alegreya-sans/files/alegreya-sans-latin-400-normal.woff2?url";
import alegreyaSans700Latin from "@fontsource/alegreya-sans/files/alegreya-sans-latin-700-normal.woff2?url";
import alegreyaSans400LatinExt from "@fontsource/alegreya-sans/files/alegreya-sans-latin-ext-400-normal.woff2?url";
import alegreyaSans700LatinExt from "@fontsource/alegreya-sans/files/alegreya-sans-latin-ext-700-normal.woff2?url";
import alegreyaLatinExt from "@fontsource-variable/alegreya/files/alegreya-latin-ext-wght-normal.woff2?url";
import alegreyaLatin from "@fontsource-variable/alegreya/files/alegreya-latin-wght-normal.woff2?url";
import cinzelLatinExt from "@fontsource-variable/cinzel/files/cinzel-latin-ext-wght-normal.woff2?url";
import cinzelLatin from "@fontsource-variable/cinzel/files/cinzel-latin-wght-normal.woff2?url";
import garamondLatinExt from "@fontsource-variable/eb-garamond/files/eb-garamond-latin-ext-wght-normal.woff2?url";
import garamondLatin from "@fontsource-variable/eb-garamond/files/eb-garamond-latin-wght-normal.woff2?url";
import interLatinExt from "@fontsource-variable/inter/files/inter-latin-ext-wght-normal.woff2?url";
import interLatin from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";
import loraLatinExt from "@fontsource-variable/lora/files/lora-latin-ext-wght-normal.woff2?url";
import loraLatin from "@fontsource-variable/lora/files/lora-latin-wght-normal.woff2?url";
import oxaniumLatinExt from "@fontsource-variable/oxanium/files/oxanium-latin-ext-wght-normal.woff2?url";
import oxaniumLatin from "@fontsource-variable/oxanium/files/oxanium-latin-wght-normal.woff2?url";
import playfairLatinExt from "@fontsource-variable/playfair-display/files/playfair-display-latin-ext-wght-normal.woff2?url";
import playfairLatin from "@fontsource-variable/playfair-display/files/playfair-display-latin-wght-normal.woff2?url";
import sourceSerifLatinExt from "@fontsource-variable/source-serif-4/files/source-serif-4-latin-ext-wght-normal.woff2?url";
import sourceSerifLatin from "@fontsource-variable/source-serif-4/files/source-serif-4-latin-wght-normal.woff2?url";
import type { SiteFontKey } from "../theme";

/** One weight (or a variable range) of a font, Latin and Latin Extended. */
type Face = { weight: string; latin: string; latinExt: string };

const variable = (latin: string, latinExt: string): Face[] => [
  { weight: "100 900", latin, latinExt },
];

/** The Latin subsets of the wiki's fonts, as the app ships them. */
const FILES: Record<SiteFontKey, { family: string; faces: Face[] }> = {
  inter: { family: "Inter Variable", faces: variable(interLatin, interLatinExt) },
  cinzel: { family: "Cinzel Variable", faces: variable(cinzelLatin, cinzelLatinExt) },
  playfair: {
    family: "Playfair Display Variable",
    faces: variable(playfairLatin, playfairLatinExt),
  },
  garamond: { family: "EB Garamond Variable", faces: variable(garamondLatin, garamondLatinExt) },
  lora: { family: "Lora Variable", faces: variable(loraLatin, loraLatinExt) },
  "source-serif": {
    family: "Source Serif 4 Variable",
    faces: variable(sourceSerifLatin, sourceSerifLatinExt),
  },
  alegreya: { family: "Alegreya Variable", faces: variable(alegreyaLatin, alegreyaLatinExt) },
  oxanium: { family: "Oxanium Variable", faces: variable(oxaniumLatin, oxaniumLatinExt) },
  // Not variable: its regular and bold (the site's text and its emphasis).
  "alegreya-sans": {
    family: "Alegreya Sans",
    faces: [
      { weight: "400", latin: alegreyaSans400Latin, latinExt: alegreyaSans400LatinExt },
      { weight: "700", latin: alegreyaSans700Latin, latinExt: alegreyaSans700LatinExt },
    ],
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

async function fontFace(
  family: string,
  weight: string,
  url: string,
  range: string,
): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`font not found: ${url}`);
  const data = base64(await response.arrayBuffer());
  return `@font-face {
  font-family: "${family}";
  font-style: normal;
  font-display: swap;
  font-weight: ${weight};
  src: url(data:font/woff2;base64,${data}) format("woff2");
  unicode-range: ${range};
}`;
}

/**
 * `fonts.css` of the exported site: the fonts the wiki uses, inside the CSS
 * itself, so the site needs no network and no extra file.
 */
export async function fontsCss(keys: SiteFontKey[]): Promise<string> {
  const faces: string[] = [];
  for (const key of new Set(keys)) {
    const { family, faces: files } = FILES[key];
    for (const { weight, latin, latinExt } of files) {
      faces.push(
        await fontFace(family, weight, latin, LATIN),
        await fontFace(family, weight, latinExt, LATIN_EXT),
      );
    }
  }
  return `/* Fonts under the SIL Open Font License, shipped with BuilderZ. */\n${faces.join("\n")}\n`;
}
