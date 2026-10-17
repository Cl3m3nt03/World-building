import { Link, useParams } from "@tanstack/react-router";
import { CalendarSearch, Maximize, X, ZoomIn, ZoomOut } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { DocumentTitleField } from "@/components/DocumentTitleField";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { typeColor } from "@/features/card-types";
import { useCardList } from "@/features/cards";
import { useMarkOpened } from "@/features/cards/hooks/useCards";
import { AssetImage } from "@/features/media";
import type { Card, Timeline, TimelineItem, WorldCalendar } from "@/lib/bindings";
import { documentRoute } from "@/lib/documentRoute";
import { formatDate } from "../calendar";
import { useRenameTimeline, useTimeline } from "../hooks/useTimelines";
import { useCalendar, useCalendarWords } from "../useCalendar";
import { DateField, type DateValue } from "./DateField";
import {
  itemLabel,
  itemTitle,
  TimelineView,
  type TimelineViewHandle,
  ZOOM_STEP,
} from "./TimelineView";

function TitleField({ timeline }: { timeline: Timeline }) {
  const { t } = useTranslation();
  const rename = useRenameTimeline(timeline.id);
  return <DocumentTitleField title={timeline.title} label={t("timelines.title")} rename={rename} />;
}

/** A timeline, opened in the World tab (M11). */
export function TimelinePage() {
  const { timelineId } = useParams({ from: "/world/$worldId/world/timeline/$timelineId" });
  const timeline = useTimeline(timelineId);
  const cards = useCardList(false);
  useMarkOpened(timelineId);
  const error = timeline.error ?? cards.error;
  if (error) {
    return (
      <div className="p-6">
        <AppErrorMessage error={error} />
      </div>
    );
  }
  if (!timeline.data || !cards.data) return null;
  // Remounted for another timeline: the view frames that timeline.
  return <TimelineScreen key={timeline.data.id} timeline={timeline.data} cards={cards.data} />;
}

function TimelineScreen({ timeline, cards }: { timeline: Timeline; cards: Card[] }) {
  const { t } = useTranslation();
  const { calendar } = useCalendar();
  const view = useRef<TimelineViewHandle>(null);
  const cardsById = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = timeline.items.find((item) => item.id === selectedId) ?? null;

  return (
    <article
      aria-label={timeline.title}
      className="glass flex h-full min-w-0 flex-col gap-3 overflow-hidden rounded-lg p-3"
    >
      <header className="flex flex-wrap items-center gap-2">
        <TitleField timeline={timeline} />
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("timelines.zoomOut")}
            title={t("timelines.zoomOut")}
            onClick={() => view.current?.zoom(1 / ZOOM_STEP)}
          >
            <ZoomOut />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("timelines.zoomIn")}
            title={t("timelines.zoomIn")}
            onClick={() => view.current?.zoom(ZOOM_STEP)}
          >
            <ZoomIn />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => view.current?.fitAll()}>
            <Maximize />
            {t("timelines.fitAll")}
          </Button>
          <GoToDate calendar={calendar} view={view} />
        </div>
      </header>
      <TimelineView
        ref={view}
        timeline={timeline}
        calendar={calendar}
        cardsById={cardsById}
        label={t("timelines.viewLabel", { name: timeline.title })}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
      {selected ? (
        <ItemDetails
          item={selected}
          timeline={timeline}
          calendar={calendar}
          card={selected.cardId ? cardsById.get(selected.cardId) : undefined}
          onClose={() => setSelectedId(null)}
        />
      ) : (
        <p className="text-xs text-muted-foreground">{t("timelines.navigationHint")}</p>
      )}
    </article>
  );
}

/** « Aller à une date »: a date of the world's calendar, then the view centres on it. */
function GoToDate({
  calendar,
  view,
}: {
  calendar: WorldCalendar;
  view: React.RefObject<TimelineViewHandle | null>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<DateValue>({ days: 0, precision: "year" });
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        // Opens on the year in the middle of the view.
        if (next) setDate({ days: Math.round(view.current?.center() ?? 0), precision: "year" });
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm">
          <CalendarSearch />
          {t("timelines.goTo")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto">
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            view.current?.goTo(date.days, date.precision);
            setOpen(false);
          }}
        >
          <DateField
            legend={t("timelines.goToDate")}
            calendar={calendar}
            value={date}
            onChange={setDate}
          />
          <Button type="submit" size="sm" className="self-end">
            {t("timelines.goToAction")}
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

/** The selected item: its name, dates, track and description, and its card. */
function ItemDetails({
  item,
  timeline,
  calendar,
  card,
  onClose,
}: {
  item: TimelineItem;
  timeline: Timeline;
  calendar: WorldCalendar;
  card: Card | undefined;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const words = useCalendarWords();
  const { worldId } = useParams({ from: "/world/$worldId/world/timeline/$timelineId" });
  const title = itemTitle(item, card);
  const track = timeline.tracks.find((each) => each.id === item.trackId);
  const dates =
    item.end === null
      ? formatDate(calendar, item.start, item.precision, words)
      : t("timelines.details.range", {
          start: formatDate(calendar, item.start, item.precision, words),
          end: formatDate(calendar, item.end, item.precision, words),
        });
  return (
    <section
      aria-label={itemLabel(t, calendar, words, item, title)}
      className="flex items-start gap-3 rounded-lg border border-border bg-background/60 p-3"
    >
      {card?.imageAssetId ? (
        <AssetImage
          assetId={card.imageAssetId}
          alt=""
          className="size-12 shrink-0 rounded-md object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="mt-1 size-3 shrink-0 rotate-45 rounded-[2px]"
          style={{ backgroundColor: typeColor(item.color) }}
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h2 className="font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">
          {dates}
          {track ? ` · ${track.name}` : ""}
        </p>
        {item.description ? (
          <p className="text-sm whitespace-pre-line">{item.description}</p>
        ) : null}
        {card ? (
          <Button asChild variant="secondary" size="sm" className="mt-1 self-start">
            <Link {...documentRoute(worldId, "card", card.id)}>
              {t("timelines.details.openCard", { name: card.title })}
            </Link>
          </Button>
        ) : null}
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("timelines.details.close")}
        onClick={onClose}
      >
        <X />
      </Button>
    </section>
  );
}
