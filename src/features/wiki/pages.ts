import type { WikiPage } from "@/lib/bindings";
import { fold } from "@/lib/text";

/** Most pages the home page's search lists. */
export const MAX_RESULTS = 8;

/**
 * The pages whose name or an alias contains `query` (accents and case
 * ignored): names first, then aliases, each by name. An empty query finds
 * nothing.
 */
export function searchPages(pages: readonly WikiPage[], query: string): WikiPage[] {
  const wanted = fold(query.trim());
  if (wanted === "") return [];
  const byName: WikiPage[] = [];
  const byAlias: WikiPage[] = [];
  for (const page of pages) {
    if (fold(page.title).includes(wanted)) byName.push(page);
    else if (page.aliases.some((alias) => fold(alias).includes(wanted))) byAlias.push(page);
  }
  const byTitle = (a: WikiPage, b: WikiPage) => a.title.localeCompare(b.title);
  return [...byName.sort(byTitle), ...byAlias.sort(byTitle)].slice(0, MAX_RESULTS);
}

/**
 * The featured pages, in their order. An id whose page is no longer in the
 * wiki (hidden, in the trash) is skipped, but stays in the settings: shown
 * again, the page comes back to its place.
 */
export function featuredPages(featured: readonly string[], pages: readonly WikiPage[]): WikiPage[] {
  const byId = new Map(pages.map((page) => [page.id, page]));
  return featured.flatMap((id) => byId.get(id) ?? []);
}

/** `featured` with `id` moved to the place of `overId`. */
export function moveFeatured(featured: readonly string[], id: string, overId: string): string[] {
  const from = featured.indexOf(id);
  const to = featured.indexOf(overId);
  if (from < 0 || to < 0 || from === to) return [...featured];
  const next = [...featured];
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}
