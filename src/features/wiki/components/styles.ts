/**
 * Classes shared by the wiki's controls: they take the wiki's theme
 * (`wiki-*` colours), not the app's.
 */
export const WIKI_BUTTON =
  "inline-flex shrink-0 items-center gap-1.5 rounded-md border border-wiki-text/15 bg-wiki-surface px-2.5 py-1 text-xs font-medium text-wiki-text outline-none transition hover:bg-wiki-background focus-visible:ring-3 focus-visible:ring-wiki-accent/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-3.5 [&_svg]:shrink-0";

/** A field written in place: it looks like text until hovered or focused. */
export const WIKI_FIELD =
  "w-full resize-none rounded-md border border-transparent bg-transparent px-1.5 outline-none transition [field-sizing:content] placeholder:text-wiki-muted/70 hover:border-wiki-text/15 focus-visible:border-wiki-accent focus-visible:ring-3 focus-visible:ring-wiki-accent/30";

export const WIKI_FOCUS = "outline-none focus-visible:ring-3 focus-visible:ring-wiki-accent/50";
