import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { useCardList } from "@/features/cards";
import { AssetImage } from "@/features/media";
import { formatDate } from "@/features/timelines/calendar";
import { itemTitle, TimelineView } from "@/features/timelines/components/TimelineView";
import { useTimeline } from "@/features/timelines/hooks/useTimelines";
import { useCalendar, useCalendarWords } from "@/features/timelines/useCalendar";
import type { Card, Timeline, TimelineItem, WorldCalendar } from "@/lib/bindings";
import { wikiCardRoute } from "@/lib/documentRoute";
import { cn } from "@/lib/utils";
import { useWikiPages } from "../hooks/useWiki";
import { useWikiLinks } from "../links";
import { NotInWiki } from "./PageParts";
import { WIKI_FOCUS } from "./styles";

/** The dates of an item as the wiki writes them: « 298 AC », « 282 AC – 283 AC ». */
export function itemDates(
  calendar: WorldCalendar,
  item: TimelineItem,
  words: ReturnType<typeof useCalendarWords>,
): string {
  const start = formatDate(calendar, item.start, item.precision, words);
  return item.end === null
    ? start
    : `${start} – ${formatDate(calendar, item.end, item.precision, words)}`;
}

/**
 * A timeline's page in the wiki (M11 step 11.6): the timeline read only
 * (axis view), then its items in time order. Items hidden with the eye are
 * left out; an item standing for a card with a page leads to that page.
 */
export function WikiTimelinePage() {
  const { t } = useTranslation();
  const { timelineId } = useParams({ from: "/world/$worldId/wiki/timeline/$timelineId" });
  const timeline = useTimeline(timelineId);
  const cards = useCardList(false);
  const pages = useWikiPages();
  const { isPage } = useWikiLinks();

  if (timeline.isError) {
    return (
      <div className="p-6">
        <AppErrorMessage error={timeline.error} />
      </div>
    );
  }
  if (!timeline.data || !cards.data || !pages.data) return null;
  if (!isPage(timelineId)) return <NotInWiki message={t("wiki.timeline.hidden")} />;
  return <WikiTimeline timeline={timeline.data} cards={cards.data} isPage={isPage} />;
}

function WikiTimeline({
  timeline,
  cards,
  isPage,
}: {
  timeline: Timeline;
  cards: Card[];
  isPage: (id: string) => boolean;
}) {
  const { t } = useTranslation();
  const { worldId } = useParams({ from: "/world/$worldId/wiki/timeline/$timelineId" });
  const navigate = useNavigate();
  const { calendar } = useCalendar();
  const words = useCalendarWords();
  const listId = useId();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const cardsById = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);
  // What the wiki shows: the items not hidden with the eye.
  const shown = useMemo(
    () => ({ ...timeline, items: timeline.items.filter((item) => !item.hidden) }),
    [timeline],
  );
  // What an item leads to, among the items shown.
  const leadsTo = (item: TimelineItem) =>
    (timeline.links ?? [])
      .filter((link) => link.from === item.id)
      .flatMap((link) => {
        const target = shown.items.find((each) => each.id === link.to);
        return target
          ? [itemTitle(target, target.cardId ? cardsById.get(target.cardId) : undefined)]
          : [];
      });
  const pageOf = (item: TimelineItem) => (item.cardId && isPage(item.cardId) ? item.cardId : null);

  return (
    <article aria-label={timeline.title} className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 p-6">
        <h1 className="font-wiki-heading text-4xl font-bold text-wiki-accent">{timeline.title}</h1>
        <div className="flex h-[55vh] min-h-80 flex-col">
          <TimelineView
            timeline={shown}
            calendar={calendar}
            cardsById={cardsById}
            label={t("timelines.viewLabel", { name: timeline.title })}
            selectedId={selectedId}
            onSelect={(id) => {
              setSelectedId(id);
              // The chronicle below says the same, for reading.
              if (id)
                document.getElementById(`${listId}-${id}`)?.scrollIntoView({ block: "nearest" });
            }}
            onOpen={(item) => {
              const page = pageOf(item);
              if (page) void navigate(wikiCardRoute(worldId, page));
            }}
          />
        </div>
        <section aria-labelledby={listId} className="flex flex-col gap-3">
          <h2 id={listId} className="font-wiki-heading text-lg font-bold">
            {t("wiki.timeline.chronicle")}
          </h2>
          {shown.items.length === 0 ? (
            <p className="text-wiki-muted">{t("wiki.timeline.empty")}</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {shown.items.map((item) => {
                const card = item.cardId ? cardsById.get(item.cardId) : undefined;
                const title = itemTitle(item, card);
                const page = pageOf(item);
                const image = item.imageAssetId ?? card?.imageAssetId ?? null;
                return (
                  <li
                    key={item.id}
                    id={`${listId}-${item.id}`}
                    className={cn(
                      "flex gap-3 rounded-lg border border-wiki-text/10 bg-wiki-surface p-3",
                      item.id === selectedId && "border-wiki-accent",
                    )}
                  >
                    {image ? (
                      <AssetImage
                        assetId={image}
                        alt=""
                        className="size-12 shrink-0 rounded-md object-cover"
                      />
                    ) : null}
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-sm text-wiki-muted tabular-nums">
                        {itemDates(calendar, item, words)}
                      </span>
                      {page ? (
                        <Link
                          {...wikiCardRoute(worldId, page)}
                          className={cn(
                            "font-semibold text-wiki-accent hover:underline",
                            WIKI_FOCUS,
                          )}
                        >
                          {title}
                        </Link>
                      ) : (
                        <span className="font-semibold">{title}</span>
                      )}
                      {item.description ? (
                        <p className="text-sm whitespace-pre-line">{item.description}</p>
                      ) : null}
                      {leadsTo(item).length > 0 ? (
                        <p className="text-sm text-wiki-muted">
                          {t("wiki.timeline.leadsTo", { names: leadsTo(item).join(", ") })}
                        </p>
                      ) : null}
                      {(item.tags ?? []).length > 0 ? (
                        <ul
                          aria-label={t("timelines.editor.tags")}
                          className="flex flex-wrap gap-1 pt-1"
                        >
                          {(item.tags ?? []).map((tag) => (
                            <li
                              key={tag}
                              className="rounded-full bg-wiki-background px-2 py-0.5 text-xs text-wiki-muted"
                            >
                              {tag}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </article>
  );
}
