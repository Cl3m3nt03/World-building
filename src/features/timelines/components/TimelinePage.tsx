import { useParams } from "@tanstack/react-router";
import {
  CalendarSearch,
  Diamond,
  Maximize,
  Plus,
  RectangleHorizontal,
  Redo2,
  Rows3,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { DocumentTitleField } from "@/components/DocumentTitleField";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCardList } from "@/features/cards";
import { useMarkOpened } from "@/features/cards/hooks/useCards";
import type { Card, DatePrecision, Timeline, WorldCalendar } from "@/lib/bindings";
import { shiftDay, snapDay } from "../edit";
import { useTimelineEditor } from "../hooks/useTimelineEditor";
import { useRenameTimeline, useTimeline } from "../hooks/useTimelines";
import { useCalendar } from "../useCalendar";
import { DateField, type DateValue } from "./DateField";
import { ItemEditor } from "./ItemEditor";
import { TimelineView, type TimelineViewHandle, ZOOM_STEP } from "./TimelineView";
import { TracksDialog } from "./TracksDialog";

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
  const editor = useTimelineEditor(timeline.id);
  const cardsById = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tracksOpen, setTracksOpen] = useState(false);
  const selected = timeline.items.find((item) => item.id === selectedId) ?? null;

  // Ctrl+Z / Ctrl+Y (or Ctrl+Shift+Z) for the timeline; fields keep their own.
  const history = useRef(editor);
  history.current = editor;
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        void history.current.undo();
      } else if (key === "y" || (key === "z" && event.shiftKey)) {
        event.preventDefault();
        void history.current.redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /** A new item on `trackId` at `day`, selected to be named. */
  const create = (
    trackId: string,
    day: number,
    precision: DatePrecision,
    kind: "event" | "period",
  ) => {
    const track = timeline.tracks.find((each) => each.id === trackId);
    const item = {
      id: crypto.randomUUID(),
      trackId,
      cardId: null,
      title: t(kind === "event" ? "timelines.newEvent" : "timelines.newPeriod"),
      color: track?.color ?? "amber",
      description: "",
      start: day,
      end: kind === "event" ? null : shiftDay(calendar, day, precision, 2),
      precision,
    };
    void editor.apply({ kind: "save", item });
    setSelectedId(item.id);
  };
  const createHere = (kind: "event" | "period") => {
    const handle = view.current;
    const trackId = selected?.trackId ?? timeline.tracks[0]?.id;
    if (!handle || !trackId) return;
    const unit = handle.unit();
    create(trackId, snapDay(calendar, handle.center(), unit), unit, kind);
  };
  const remove = (id: string) => {
    void editor.apply({ kind: "delete", id });
    if (id === selectedId) setSelectedId(null);
  };

  return (
    <article
      aria-label={timeline.title}
      className="glass flex h-full min-w-0 flex-col gap-3 overflow-hidden rounded-lg p-3"
    >
      <header className="flex flex-wrap items-center gap-2">
        <TitleField timeline={timeline} />
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm">
                <Plus />
                {t("timelines.add")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onSelect={() => createHere("event")}>
                <Diamond />
                {t("timelines.addEvent")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => createHere("period")}>
                <RectangleHorizontal />
                {t("timelines.addPeriod")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="secondary" size="sm" onClick={() => setTracksOpen(true)}>
            <Rows3 />
            {t("timelines.tracks.open")}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("timelines.undo")}
            title={t("timelines.undo")}
            disabled={!editor.canUndo}
            onClick={() => void editor.undo()}
          >
            <Undo2 />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("timelines.redo")}
            title={t("timelines.redo")}
            disabled={!editor.canRedo}
            onClick={() => void editor.redo()}
          >
            <Redo2 />
          </Button>
        </div>
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
      {editor.error ? <AppErrorMessage error={editor.error} /> : null}
      <div className="flex min-h-0 flex-1 gap-3">
        <TimelineView
          ref={view}
          timeline={timeline}
          calendar={calendar}
          cardsById={cardsById}
          label={t("timelines.viewLabel", { name: timeline.title })}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onChange={(item) => void editor.apply({ kind: "save", item })}
          onCreate={(trackId, day, precision) => create(trackId, day, precision, "event")}
          onDelete={remove}
        />
        {selected ? (
          <ItemEditor
            key={selected.id}
            item={selected}
            timeline={timeline}
            calendar={calendar}
            card={selected.cardId ? cardsById.get(selected.cardId) : undefined}
            onSave={(item) => void editor.apply({ kind: "save", item })}
            onDelete={remove}
            onClose={() => setSelectedId(null)}
          />
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">{t("timelines.navigationHint")}</p>
      <TracksDialog
        open={tracksOpen}
        onOpenChange={setTracksOpen}
        timeline={timeline}
        editor={editor}
      />
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
