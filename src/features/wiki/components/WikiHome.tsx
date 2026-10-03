import { Link, useParams } from "@tanstack/react-router";
import { BookOpen, ImagePlus, Search, X } from "lucide-react";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { AssetImage, ImagePickerDialog } from "@/features/media";
import { useCurrentWorld } from "@/features/world";
import type { WikiPage, WikiSettings } from "@/lib/bindings";
import { cn } from "@/lib/utils";
import { useSaveWikiSettings, useWikiPages, useWikiSettings } from "../hooks/useWiki";
import { pageRoute } from "../links";
import { featuredPages, searchPages } from "../pages";
import { FeaturedGrid } from "./FeaturedGrid";
import { PageIcon } from "./PageIcon";
import { WIKI_BUTTON, WIKI_FIELD, WIKI_FOCUS } from "./styles";
import { WikiHero } from "./WikiHero";

/**
 * The wiki's home page (docs/features/07-wiki.md): on the left, the large
 * image of the featured pages; on the right, the banner, the title and the
 * description written in place, the search among the pages, and the grid
 * of featured pages.
 */
export function WikiHome() {
  const { t } = useTranslation();
  const settings = useWikiSettings();
  const pages = useWikiPages();
  const { data: world } = useCurrentWorld();
  const save = useSaveWikiSettings();

  const error = settings.error ?? pages.error;
  if (error) {
    return (
      <div className="p-4">
        <AppErrorMessage error={error} />
      </div>
    );
  }
  if (!settings.data || !pages.data || !world) return null;

  const current = settings.data;
  const update = (change: Partial<WikiSettings>) => save.mutate({ ...current, ...change });
  const title = current.title || world.name;
  const withImage = featuredPages(current.featured, pages.data).filter(
    (page) => page.imageAssetId !== null,
  );

  return (
    <main
      aria-label={t("wiki.home.label")}
      className="grid h-full grid-rows-[14rem_minmax(0,1fr)] gap-4 p-4 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:grid-rows-1"
    >
      <WikiHero pages={withImage} />
      <div className="scrollbar-thin flex min-h-0 flex-col gap-5 overflow-y-auto pr-1">
        <Banner
          assetId={current.bannerAssetId}
          onChange={(bannerAssetId) => update({ bannerAssetId })}
        />
        {save.error && <AppErrorMessage error={save.error} />}
        <div className="flex flex-col gap-2">
          <TextField
            label={t("wiki.home.titleLabel")}
            value={title}
            maxLength={200}
            // The world's name is kept as "no title of its own".
            onSave={(text) => update({ title: text === world.name ? "" : text })}
            className="font-wiki-heading text-3xl font-bold text-wiki-accent"
          />
          <TextField
            multiline
            label={t("wiki.home.descriptionLabel")}
            placeholder={t("wiki.home.descriptionPlaceholder")}
            value={current.description}
            maxLength={20000}
            onSave={(description) => update({ description })}
            className="text-sm leading-relaxed whitespace-pre-wrap"
          />
        </div>
        {pages.data.length === 0 ? (
          <EmptyWiki />
        ) : (
          <>
            <PageSearch pages={pages.data} title={title} />
            <FeaturedGrid
              pages={pages.data}
              featured={current.featured}
              onChange={(featured) => update({ featured })}
            />
          </>
        )}
      </div>
    </main>
  );
}

/** The banner, chosen in the media library. */
function Banner({
  assetId,
  onChange,
}: {
  assetId: string | null;
  onChange: (assetId: string | null) => void;
}) {
  const { t } = useTranslation();
  const [picking, setPicking] = useState(false);
  return (
    <div className="group relative aspect-[4/1] shrink-0 overflow-hidden rounded-lg bg-wiki-surface">
      {assetId ? (
        <AssetImage
          assetId={assetId}
          alt={t("wiki.home.banner")}
          className="size-full object-cover"
        />
      ) : (
        <div className="flex size-full items-center justify-center border border-dashed border-wiki-text/20 rounded-lg" />
      )}
      <div
        className={cn(
          "absolute top-2 right-2 flex gap-1.5 transition",
          // Shown on hover or focus once there is a banner; always without one.
          assetId && "opacity-0 group-hover:opacity-100 focus-within:opacity-100",
        )}
      >
        <button type="button" className={WIKI_BUTTON} onClick={() => setPicking(true)}>
          <ImagePlus aria-hidden />
          {t(assetId ? "wiki.home.changeBanner" : "wiki.home.addBanner")}
        </button>
        {assetId && (
          <button
            type="button"
            className={WIKI_BUTTON}
            aria-label={t("wiki.home.removeBanner")}
            onClick={() => onChange(null)}
          >
            <X aria-hidden />
          </button>
        )}
      </div>
      <ImagePickerDialog
        open={picking}
        onOpenChange={setPicking}
        title={t("wiki.home.banner")}
        selectedId={assetId}
        onPick={(id) => onChange(id)}
      />
    </div>
  );
}

type TextFieldProps = {
  label: string;
  value: string;
  maxLength: number;
  onSave: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
};

/**
 * Text written in place: saved when the field is left, or on Enter for a
 * line; Escape gives the saved text back.
 */
function TextField({
  label,
  value,
  maxLength,
  onSave,
  placeholder,
  multiline = false,
  className,
}: TextFieldProps) {
  const [draft, setDraft] = useState(value);
  const cancelled = useRef(false);
  useEffect(() => setDraft(value), [value]);

  const commit = () => {
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    const text = multiline ? draft.trim() : draft.trim().replace(/\s+/g, " ");
    if (text !== value) onSave(text);
    else setDraft(value);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelled.current = true;
      setDraft(value);
      event.currentTarget.blur();
    } else if (event.key === "Enter" && !multiline) {
      event.preventDefault();
      event.currentTarget.blur();
    }
  };
  const props = {
    "aria-label": label,
    value: draft,
    maxLength,
    placeholder,
    onChange: (event: { target: { value: string } }) => setDraft(event.target.value),
    onBlur: commit,
    onKeyDown,
    className: cn(WIKI_FIELD, className),
  };
  return multiline ? <textarea rows={2} {...props} /> : <input {...props} />;
}

/** The search among the pages: by name or alias. */
function PageSearch({ pages, title }: { pages: WikiPage[]; title: string }) {
  const { t } = useTranslation();
  const { worldId } = useParams({ from: "/world/$worldId" });
  const [query, setQuery] = useState("");
  const listId = useId();
  const results = searchPages(pages, query);
  const searching = query.trim() !== "";

  return (
    <search className="relative flex flex-col gap-1.5">
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-wiki-muted"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setQuery("");
          }}
          placeholder={t("wiki.home.search", { title })}
          aria-label={t("wiki.home.search", { title })}
          aria-controls={searching ? listId : undefined}
          className="h-9 w-full rounded-md border border-wiki-text/15 bg-wiki-surface pr-3 pl-9 text-sm text-wiki-text outline-none placeholder:text-wiki-muted focus-visible:border-wiki-accent focus-visible:ring-3 focus-visible:ring-wiki-accent/30"
        />
      </div>
      {searching &&
        (results.length === 0 ? (
          <p className="px-1 text-sm text-wiki-muted">{t("wiki.home.noResult")}</p>
        ) : (
          <ul
            id={listId}
            aria-label={t("wiki.home.results")}
            className="flex flex-col rounded-md border border-wiki-text/10 bg-wiki-surface p-1"
          >
            {results.map((page) => (
              <li key={page.id}>
                <Link
                  {...pageRoute(worldId, page)}
                  className={cn(
                    "flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-wiki-background",
                    WIKI_FOCUS,
                  )}
                >
                  <PageIcon page={page} className="size-4" />
                  <span className="truncate">{page.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        ))}
    </search>
  );
}

/** No page yet: how to make one. */
function EmptyWiki() {
  const { t } = useTranslation();
  const { worldId } = useParams({ from: "/world/$worldId" });
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-wiki-text/20 p-6 text-center">
      <BookOpen aria-hidden className="size-8 text-wiki-muted" />
      <p className="font-wiki-heading text-lg font-bold">{t("wiki.empty.title")}</p>
      <p className="max-w-sm text-sm text-wiki-muted">{t("wiki.empty.description")}</p>
      <Link to="/world/$worldId/world" params={{ worldId }} className={WIKI_BUTTON}>
        {t("wiki.empty.action")}
      </Link>
    </div>
  );
}
