import { useNavigate, useParams } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useUiStore } from "@/app/stores/ui";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { typeColor, typeIcon, useCardTypes } from "@/features/card-types";
import type { SearchHit, TextPart } from "@/lib/bindings";
import { cn } from "@/lib/utils";
import { useSearch } from "../hooks/useSearch";

type Props = {
  /** What the sidebar shows while nothing is typed (pins and tree). */
  children: ReactNode;
};

/**
 * The search field at the top of the sidebar (docs/features/02-organisation.md).
 * While something is typed, the results take the place of the pins and the
 * tree: name and alias matches, then content matches with an excerpt.
 * Arrows move, Enter opens, Escape clears; Ctrl+K comes here from anywhere.
 */
export function SidebarSearch({ children }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { worldId } = useParams({ from: "/world/$worldId" });
  const types = useCardTypes();
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const results = useSearch(query);
  const searching = query.trim() !== "";
  const hits = searching ? (results.data ?? []) : [];
  const activeIndex = Math.min(active, hits.length - 1);

  // Ctrl+K (WorldLayout): the field takes the focus, its text selected.
  const searchRequest = useUiStore((state) => state.searchRequest);
  useEffect(() => {
    if (searchRequest === 0) return;
    input.current?.focus();
    input.current?.select();
  }, [searchRequest]);

  const open = (hit: SearchHit | undefined) => {
    if (!hit) return;
    void navigate({
      to: "/world/$worldId/world/card/$cardId",
      params: { worldId, cardId: hit.id },
    });
  };
  const optionId = (index: number) => `${listId}-${index}`;
  const names = hits.filter((hit) => hit.match.kind !== "content");
  const contents = hits.filter((hit) => hit.match.kind === "content");

  const option = (hit: SearchHit, index: number) => {
    const type = types.data?.find((candidate) => candidate.id === hit.typeId);
    const Icon = typeIcon(type?.icon ?? "shapes");
    return (
      // biome-ignore lint/a11y/useKeyWithClickEvents: the search field handles the keys (aria-activedescendant).
      <div
        key={hit.id}
        id={optionId(index)}
        role="option"
        tabIndex={-1}
        aria-selected={index === activeIndex}
        onMouseMove={() => setActive(index)}
        onClick={() => open(hit)}
        className={cn(
          "flex cursor-default flex-col gap-0.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground",
          index === activeIndex && "bg-accent text-foreground",
        )}
      >
        <span className="flex items-center gap-1.5">
          <Icon
            aria-hidden
            className="size-4 shrink-0"
            style={{ color: typeColor(type?.color ?? "slate") }}
          />
          <span className="truncate">
            <Marked parts={hit.title} />
          </span>
        </span>
        {hit.match.kind === "alias" && (
          <span className="truncate pl-5.5 text-xs">
            {t("sidebar.search.alias")} <Marked parts={hit.match.alias} />
          </span>
        )}
        {hit.match.kind === "content" && (
          <span className="line-clamp-2 pl-5.5 text-xs">
            <Marked parts={hit.match.excerpt} />
          </span>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="p-2 pb-1">
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            ref={input}
            type="search"
            role="combobox"
            aria-label={t("sidebar.search.label")}
            aria-controls={listId}
            aria-expanded={searching}
            aria-autocomplete="list"
            aria-activedescendant={
              searching && activeIndex >= 0 ? optionId(activeIndex) : undefined
            }
            aria-keyshortcuts="Control+K"
            placeholder={t("sidebar.search.placeholder")}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") setActive(Math.min(activeIndex + 1, hits.length - 1));
              else if (event.key === "ArrowUp") setActive(Math.max(activeIndex - 1, 0));
              else if (event.key === "Enter") open(hits[activeIndex]);
              else if (event.key === "Escape" && query !== "") setQuery("");
              else if (event.key === "Escape") event.currentTarget.blur();
              else return;
              event.preventDefault();
            }}
            className="h-8 w-full rounded-md border border-border bg-background/50 pr-8 pl-8 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-search-cancel-button]:hidden"
          />
          {searching && (
            <button
              type="button"
              aria-label={t("sidebar.search.clear")}
              title={t("sidebar.search.clear")}
              onClick={() => {
                setQuery("");
                input.current?.focus();
              }}
              className="absolute top-1/2 right-1.5 flex size-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>
      {searching ? (
        <div
          id={listId}
          role="listbox"
          aria-label={t("sidebar.search.results")}
          className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2 pt-1"
        >
          {results.error && <AppErrorMessage error={results.error} />}
          {names.length > 0 && (
            // biome-ignore lint/a11y/useSemanticElements: a group of options in a listbox (ARIA), not a form fieldset.
            <div role="group" aria-label={t("sidebar.search.names")} className="flex flex-col">
              <div
                role="presentation"
                className="px-2 pb-1 text-xs font-medium text-muted-foreground"
              >
                {t("sidebar.search.names")}
              </div>
              {names.map((hit) => option(hit, hits.indexOf(hit)))}
            </div>
          )}
          {contents.length > 0 && (
            // biome-ignore lint/a11y/useSemanticElements: a group of options in a listbox (ARIA), not a form fieldset.
            <div role="group" aria-label={t("sidebar.search.contents")} className="flex flex-col">
              <div
                role="presentation"
                className="px-2 pb-1 text-xs font-medium text-muted-foreground"
              >
                {t("sidebar.search.contents")}
              </div>
              {contents.map((hit) => option(hit, hits.indexOf(hit)))}
            </div>
          )}
          {results.isSuccess && !results.isPlaceholderData && hits.length === 0 && (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">
              {t("sidebar.search.none", { query: query.trim() })}
            </p>
          )}
        </div>
      ) : (
        children
      )}
    </>
  );
}

/** A text with its matched words highlighted. */
function Marked({ parts }: { parts: TextPart[] }) {
  return parts.map((part, index) =>
    part.matched ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: the parts of one text never move.
      <mark key={index} className="rounded-sm bg-primary/25 px-px text-foreground">
        {part.text}
      </mark>
    ) : (
      // biome-ignore lint/suspicious/noArrayIndexKey: the parts of one text never move.
      <span key={index}>{part.text}</span>
    ),
  );
}
