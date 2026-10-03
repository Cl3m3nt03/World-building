import type { WikiPage } from "@/lib/bindings";

/** Most pages the wiki's search lists. */
export const MAX_RESULTS = 8;

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
