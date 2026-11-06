import type { TFunction } from "i18next";
import faviconPng from "@/assets/brand/favicon.png?inline";
import { commands, type SiteFile } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";
import { DEFAULT_LOOK, resolveTheme, themeScheme, themeStyle, type WikiLook } from "../theme";
import { collectSite, type SiteData } from "./collect";
import { fontsCss } from "./fonts";
import {
  CardPageView,
  HomePage,
  MapPageView,
  pageFile,
  renderDocument,
  type SiteContext,
  TimelinePageView,
  usedAssets,
} from "./site";
import { rootCss, SITE_CSS, SITE_JS } from "./static";
import { plainText } from "./text";

/** Files written per call to the Rust side. */
const FILES_PER_BATCH = 20;

/** Images copied per call to the Rust side. */
const ASSETS_PER_BATCH = 10;

export type ExportStep = "read" | "write" | "assets";

export type ExportProgress = { step: ExportStep; done: number; total: number };

type Options = {
  /** The folder chosen; the site's own folder is made in it. */
  parent: string;
  worldName: string;
  t: TFunction;
  language: string;
  /** The card-type colours as the wiki shows them (its light or dark set). */
  typeColors: Record<string, string>;
  /**
   * What the Atlas theme follows: the world's theme and the mode shown when
   * exporting, frozen in the site. Absent: Vélin in light.
   */
  look?: WikiLook;
  onProgress: (progress: ExportProgress) => void;
};

/** The search index: each page's name, aliases and text. */
function searchIndex(data: SiteData): string {
  const name = (id: string) => data.cards.find((card) => card.id === id)?.title ?? null;
  const pages = data.pages.map((page) => {
    const card = data.cardPages.find((candidate) => candidate.page.id === page.id);
    const text = (card?.blocks ?? [])
      .flatMap((block) => (block.type === "text" ? [plainText(block.doc, name)] : []))
      .join(" ");
    return { u: pageFile(page.id), t: page.title, a: page.aliases, x: text };
  });
  return `window.BZ_SEARCH = ${JSON.stringify({ pages })};\n`;
}

/**
 * The site's favicon, the app's icon: an SVG wrapping the PNG, since the
 * site's files are text (one file for every page, not a copy in each).
 */
const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><image href="${faviconPng}" width="32" height="32"/></svg>\n`;

/** The site's stylesheet: the theme's variables, then the site's rules. */
function styleCss(data: SiteData, typeColors: Record<string, string>, look: WikiLook): string {
  const variables: Record<string, string> = { "--scheme": themeScheme(data.settings.theme, look) };
  for (const [name, value] of Object.entries(themeStyle(data.settings.theme, look))) {
    if (name.startsWith("--")) variables[name] = String(value);
  }
  return rootCss({ ...variables, ...typeColors }) + SITE_CSS;
}

/**
 * Exports the wiki as a static site (ADR 0008): reads it from the world,
 * renders every page, has the Rust side write the files and copy the images
 * into a folder named after the wiki in `parent`. Returns that folder.
 */
export async function exportWiki({
  parent,
  worldName,
  t,
  language,
  typeColors,
  look = DEFAULT_LOOK,
  onProgress,
}: Options): Promise<string> {
  const data = await collectSite(worldName, (done, total) =>
    onProgress({ step: "read", done, total }),
  );
  const dir = await unwrap(commands.startWikiExport(parent, data.title));
  const pageIds = new Set(data.pages.map((page) => page.id));
  const ctx = (base: string): SiteContext => ({ data, t, language, base, pageIds });
  const { headingFont, bodyFont } = resolveTheme(data.settings.theme, look);

  const files: SiteFile[] = [
    { path: "index.html", content: renderDocument(<HomePage ctx={ctx("")} />) },
    ...data.cardPages.map((card) => ({
      path: pageFile(card.page.id),
      content: renderDocument(<CardPageView ctx={ctx("../")} card={card} />),
    })),
    ...data.mapPages.map((map) => ({
      path: pageFile(map.page.id),
      content: renderDocument(<MapPageView ctx={ctx("../")} map={map} />),
    })),
    ...data.timelinePages.map((timeline) => ({
      path: pageFile(timeline.page.id),
      content: renderDocument(<TimelinePageView ctx={ctx("../")} timeline={timeline} />),
    })),
    { path: "search.js", content: searchIndex(data) },
    { path: "site.js", content: SITE_JS },
    { path: "style.css", content: styleCss(data, typeColors, look) },
    { path: "fonts.css", content: await fontsCss([headingFont, bodyFont]) },
    { path: "favicon.svg", content: FAVICON_SVG },
  ];
  for (let at = 0; at < files.length; at += FILES_PER_BATCH) {
    await unwrap(commands.writeWikiExport(files.slice(at, at + FILES_PER_BATCH)));
    onProgress({
      step: "write",
      done: Math.min(at + FILES_PER_BATCH, files.length),
      total: files.length,
    });
  }

  const assets = usedAssets(data);
  onProgress({ step: "assets", done: 0, total: assets.length });
  for (let at = 0; at < assets.length; at += ASSETS_PER_BATCH) {
    await unwrap(commands.copyWikiExportAssets(assets.slice(at, at + ASSETS_PER_BATCH)));
    onProgress({
      step: "assets",
      done: Math.min(at + ASSETS_PER_BATCH, assets.length),
      total: assets.length,
    });
  }
  return dir;
}
