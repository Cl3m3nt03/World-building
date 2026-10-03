import { Link, useParams } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Marked } from "@/components/Marked";
import { useSearch } from "@/features/sidebar";
import type { SearchHit, WikiPage } from "@/lib/bindings";
import { cn } from "@/lib/utils";
import { useWikiPages } from "../hooks/useWiki";
import { pageRoute } from "../links";
import { MAX_RESULTS } from "../pages";
import { PageIcon } from "./PageIcon";
import { WIKI_FOCUS } from "./styles";

type Props = {
  placeholder: string;
  /** "home": a large field, its results below; "bar": compact, results over the page. */
  variant: "home" | "bar";
};

/**
 * The search among the wiki's pages: by name, alias or text (the world's
 * search, keeping the pages only). Escape clears it.
 */
export function WikiSearch({ placeholder, variant }: Props) {
  const { t } = useTranslation();
  const { worldId } = useParams({ from: "/world/$worldId" });
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(true);
  const listId = useId();
  const pages = useWikiPages();
  const search = useSearch(query);
  const byId = useMemo(
    () => new Map((pages.data ?? []).map((page) => [page.id, page])),
    [pages.data],
  );
  const hits = (search.data ?? [])
    .flatMap((hit) => {
      const page = byId.get(hit.id);
      return page ? [{ hit, page }] : [];
    })
    .slice(0, MAX_RESULTS);
  const searching = query.trim() !== "" && search.searched !== "" && open;
  const bar = variant === "bar";

  return (
    <search
      className={cn("relative", bar ? "w-64 max-w-full" : "flex flex-col gap-1.5")}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onFocus={() => setOpen(true)}
    >
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-wiki-muted"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setQuery("");
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          aria-controls={searching ? listId : undefined}
          className={cn(
            "w-full rounded-md border border-wiki-text/15 bg-wiki-surface pr-3 pl-9 text-sm text-wiki-text outline-none placeholder:text-wiki-muted focus-visible:border-wiki-accent focus-visible:ring-3 focus-visible:ring-wiki-accent/30",
            bar ? "h-8" : "h-9",
          )}
        />
      </div>
      {searching && (
        <div
          className={cn(
            bar &&
              "absolute top-full right-0 z-20 mt-1 w-80 max-w-[calc(100vw-2rem)] rounded-md shadow-lg",
          )}
        >
          {hits.length === 0 ? (
            <p
              className={cn(
                "px-1 text-sm text-wiki-muted",
                bar && "rounded-md border border-wiki-text/10 bg-wiki-surface p-3",
              )}
            >
              {t("wiki.home.noResult")}
            </p>
          ) : (
            <ul
              id={listId}
              aria-label={t("wiki.home.results")}
              className="flex flex-col rounded-md border border-wiki-text/10 bg-wiki-surface p-1"
            >
              {hits.map(({ hit, page }) => (
                <li key={page.id}>
                  <Link
                    {...pageRoute(worldId, page)}
                    onClick={() => {
                      setQuery("");
                    }}
                    className={cn(
                      "flex items-start gap-2 rounded px-2 py-1.5 text-sm hover:bg-wiki-background",
                      WIKI_FOCUS,
                    )}
                  >
                    <PageIcon page={page} className="mt-0.5 size-4" />
                    <HitText hit={hit} page={page} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </search>
  );
}

/** A result: its name, and where else it matched (an alias, its text). */
function HitText({ hit, page }: { hit: SearchHit; page: WikiPage }) {
  const { match } = hit;
  return (
    <span className="flex min-w-0 flex-col">
      <span className="truncate">
        {hit.title.length > 0 ? <Marked parts={hit.title} /> : page.title}
      </span>
      {match.kind === "alias" && (
        <span className="truncate text-xs text-wiki-muted">
          <Marked parts={match.alias} />
        </span>
      )}
      {match.kind === "content" && (
        <span className="line-clamp-2 text-xs text-wiki-muted">
          <Marked parts={match.excerpt} />
        </span>
      )}
    </span>
  );
}
