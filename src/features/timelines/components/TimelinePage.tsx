import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import {
  BookOpen,
  CalendarSearch,
  CircleHelp,
  Diamond,
  GitCommitHorizontal,
  Globe,
  IdCard,
  ListFilter,
  Maximize,
  Play,
  Plus,
  RectangleHorizontal,
  Redo2,
  Rows3,
  Settings2,
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useCardList } from "@/features/cards";
import { useMarkOpened } from "@/features/cards/hooks/useCards";
import { useSetWikiVisible, useWikiPages } from "@/features/wiki/hooks/useWiki";
import type { Card, DatePrecision, Timeline, WorldCalendar } from "@/lib/bindings";
import { documentRoute, wikiTimelineRoute } from "@/lib/documentRoute";
import { livesAt } from "../ages";
import { shiftDay, snapDay } from "../edit";
import { useTimelineEditor } from "../hooks/useTimelineEditor";
import { useRenameTimeline, useTimeline } from "../hooks/useTimelines";
import { useCalendar } from "../useCalendar";
import { AddCardsDialog } from "./AddCardsDialog";
import { DateField, type DateValue } from "./DateField";
import { ItemEditor } from "./ItemEditor";
import { Minimap, type Shown } from "./Minimap";
import { StoryPlayer } from "./StoryPlayer";
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
  const navigate = useNavigate();
  const { worldId } = useParams({ from: "/world/$worldId/world/timeline/$timelineId" });
  // « Cité dans » asks for a card: its first item is shown, centred and selected.
  const { card: focusCard } = useSearch({ from: "/world/$worldId/world/timeline/$timelineId" });
  const focusId = focusCard
    ? (timeline.items.find((item) => item.cardId === focusCard)?.id ?? null)
    : null;
  const [selectedId, setSelectedId] = useState<string | null>(focusId);
  // Items placed out of sight (« Ajouter des cartes ») are brought into view.
  const [revealId, setRevealId] = useState<string | null>(null);
  useEffect(() => {
    if (focusId) {
      setSelectedId(focusId);
      setRevealId(null);
    }
  }, [focusId]);
  const [tracksOpen, setTracksOpen] = useState(false);
  const [addingCards, setAddingCards] = useState<{ trackId: string; date: DateValue } | null>(null);
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
  const addCards = () => {
    const handle = view.current;
    const trackId = selected?.trackId ?? timeline.tracks[0]?.id;
    if (!handle || !trackId) return;
    const unit = handle.unit();
    setAddingCards({
      trackId,
      date: { days: snapDay(calendar, handle.center(), unit), precision: unit },
    });
  };
  const remove = (id: string) => {
    void editor.apply({ kind: "delete", id });
    if (id === selectedId) setSelectedId(null);
  };

  // The tag filter: items without any chosen tag are faded.
  const [tags, setTags] = useState<ReadonlySet<string>>(new Set());
  const allTags = useMemo(
    () =>
      [...new Set(timeline.items.flatMap((item) => item.tags ?? []))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [timeline.items],
  );
  const dimmedIds = useMemo(
    () =>
      tags.size === 0
        ? undefined
        : new Set(
            timeline.items
              .filter((item) => !(item.tags ?? []).some((tag) => tags.has(tag)))
              .map((item) => item.id),
          ),
    [timeline.items, tags],
  );
  const [mode, setMode] = useState<"axis" | "tracks">("axis");
  // The item card floats on the side away from the selected item.
  const [itemSide, setItemSide] = useState<"left" | "right">("right");
  // « Lecture »: the items told in time order (those the tag filter keeps), and where it is.
  const told = useMemo(
    () =>
      [...timeline.items]
        .filter((item) => !dimmedIds?.has(item.id))
        .sort((a, b) => a.start - b.start),
    [timeline.items, dimmedIds],
  );
  const [story, setStory] = useState<number | null>(null);
  const tell = (index: number) => {
    const item = told[index];
    if (!item) return;
    setStory(index);
    setSelectedId(item.id);
    view.current?.centerAt((item.start + (item.end ?? item.start)) / 2);
  };
  // What the view shows, for the minimap.
  const [shown, setShown] = useState<Shown | null>(null);
  const wikiPages = useWikiPages();
  const setWikiVisible = useSetWikiVisible();
  const inWiki = wikiPages.data?.some((page) => page.id === timeline.id) ?? false;

  return (
    <article
      aria-label={timeline.title}
      className="glass relative flex h-full min-w-0 flex-col gap-2 overflow-hidden rounded-lg p-2"
    >
      <header className="flex flex-wrap items-center gap-2 px-1">
        <TitleField timeline={timeline} />
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            aria-pressed={inWiki}
            className="aria-pressed:bg-secondary"
            onClick={() => setWikiVisible.mutate({ id: timeline.id, visible: !inWiki })}
          >
            <Globe />
            {t("sidebar.document.wiki")}
          </Button>
          {inWiki && (
            <Button asChild variant="ghost" size="sm">
              <Link {...wikiTimelineRoute(worldId, timeline.id)}>
                <BookOpen />
                {t("wiki.openInWiki")}
              </Link>
            </Button>
          )}
          <GoToDate calendar={calendar} view={view} />
        </div>
      </header>
      {editor.error ? <AppErrorMessage error={editor.error} /> : null}
      <div className="relative flex min-h-0 flex-1">
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
          onOpen={(item) => {
            if (item.cardId) void navigate(documentRoute(worldId, "card", item.cardId));
          }}
          focusId={revealId ?? focusId}
          mode={mode}
          dimmedIds={dimmedIds}
          onSelectedSide={setItemSide}
          onShownChange={setShown}
          onCardDrop={(cardId, day, precision, trackId, itemId) => {
            // Dropped on an item: the item now stands for the card.
            const target = itemId ? timeline.items.find((each) => each.id === itemId) : undefined;
            if (target) {
              void editor.apply({ kind: "save", item: { ...target, cardId } });
              setSelectedId(target.id);
              return;
            }
            // Without a track under it (axis view): the selected item's, or the first.
            const track =
              timeline.tracks.find((each) => each.id === trackId) ??
              timeline.tracks.find((each) => each.id === selected?.trackId) ??
              timeline.tracks[0];
            if (!track) return;
            const item = {
              id: crypto.randomUUID(),
              trackId: track.id,
              cardId,
              title: "",
              color: track.color,
              description: "",
              start: day,
              end: null,
              precision,
            };
            void editor.apply({ kind: "save", item });
            setSelectedId(item.id);
          }}
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
            side={itemSide === "right" ? "left" : "right"}
            lives={livesAt(calendar, timeline.items, selected.start, selected.id).map((life) => {
              const lived = life.item.cardId ? cardsById.get(life.item.cardId) : undefined;
              return {
                id: life.item.id,
                name: life.item.title.trim() || lived?.title || "",
                imageAssetId: life.item.imageAssetId ?? lived?.imageAssetId ?? null,
                age: life.age,
              };
            })}
            onSelectItem={setSelectedId}
          />
        ) : null}

        {/* The whole timeline, above the tools. */}
        {shown ? (
          <div className="absolute right-16 bottom-16 left-14 z-20">
            <Minimap
              timeline={timeline}
              calendar={calendar}
              shown={shown}
              onCenter={(day) => view.current?.centerAt(day)}
            />
          </div>
        ) : null}

        {/* The tools, floating at the bottom (after vvd); the player while a story plays. */}
        {story !== null && told[story] ? (
          <StoryPlayer
            count={told.length}
            index={story}
            onIndex={tell}
            onExit={() => setStory(null)}
          />
        ) : (
          <div
            role="toolbar"
            aria-label={t("timelines.toolbar")}
            className="glass absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full p-1 shadow-lg"
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="rounded-full">
                  <Plus />
                  {t("timelines.add")}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start">
                <DropdownMenuItem onSelect={() => createHere("event")}>
                  <Diamond />
                  {t("timelines.addEvent")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => createHere("period")}>
                  <RectangleHorizontal />
                  {t("timelines.addPeriod")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={addCards}>
                  <IdCard />
                  {t("timelines.addCards.open")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <TagFilter all={allTags} chosen={tags} onChange={setTags} />
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-full"
              aria-label={t("timelines.story.start")}
              title={t("timelines.story.start")}
              disabled={told.length === 0}
              onClick={() =>
                tell(
                  Math.max(
                    0,
                    told.findIndex((item) => item.id === selectedId),
                  ),
                )
              }
            >
              <Play />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-full"
              aria-label={t("timelines.tracks.open")}
              title={t("timelines.tracks.open")}
              onClick={() => setTracksOpen(true)}
            >
              <Settings2 />
            </Button>
            <span aria-hidden className="mx-0.5 h-5 w-px bg-border" />
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-full"
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
              className="rounded-full"
              aria-label={t("timelines.redo")}
              title={t("timelines.redo")}
              disabled={!editor.canRedo}
              onClick={() => void editor.redo()}
            >
              <Redo2 />
            </Button>
            <span aria-hidden className="mx-0.5 h-5 w-px bg-border" />
            <ToggleGroup
              type="single"
              value={mode}
              onValueChange={(next) => {
                if (next === "axis" || next === "tracks") setMode(next);
              }}
              aria-label={t("timelines.mode.label")}
              className="gap-0.5"
            >
              <ToggleGroupItem
                value="axis"
                aria-label={t("timelines.mode.axis")}
                title={t("timelines.mode.axis")}
                className="rounded-full"
              >
                <GitCommitHorizontal />
              </ToggleGroupItem>
              <ToggleGroupItem
                value="tracks"
                aria-label={t("timelines.mode.tracks")}
                title={t("timelines.mode.tracks")}
                className="rounded-full"
              >
                <Rows3 />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        )}

        {/* Zoom, at the bottom right. */}
        <div className="glass absolute right-3 bottom-3 z-20 flex flex-col gap-0.5 rounded-xl p-1 shadow-lg">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("timelines.zoomIn")}
            title={t("timelines.zoomIn")}
            onClick={() => view.current?.zoom(ZOOM_STEP)}
          >
            <ZoomIn />
          </Button>
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
            aria-label={t("timelines.fitAll")}
            title={t("timelines.fitAll")}
            onClick={() => view.current?.fitAll()}
          >
            <Maximize />
          </Button>
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="glass absolute bottom-3 left-3 z-20 rounded-full shadow-lg"
              aria-label={t("timelines.help")}
              title={t("timelines.help")}
            >
              <CircleHelp />
            </Button>
          </PopoverTrigger>
          <PopoverContent side="top" align="start" className="w-80 text-sm">
            {t("timelines.navigationHint")}
          </PopoverContent>
        </Popover>
      </div>
      {addingCards ? (
        <AddCardsDialog
          onClose={() => setAddingCards(null)}
          timeline={timeline}
          calendar={calendar}
          cards={cards}
          trackId={addingCards.trackId}
          date={addingCards.date}
          onPlace={(items) => {
            void editor.apply({
              kind: "batch",
              ops: items.map((item) => ({ kind: "save", item })),
            });
            if (items[0]) {
              setSelectedId(items[0].id);
              setRevealId(items[0].id);
            }
          }}
        />
      ) : null}
      <TracksDialog
        open={tracksOpen}
        onOpenChange={setTracksOpen}
        timeline={timeline}
        editor={editor}
      />
    </article>
  );
}

/** The tag filter: the timeline's tags; with some chosen, the other items fade. */
function TagFilter({
  all,
  chosen,
  onChange,
}: {
  all: string[];
  chosen: ReadonlySet<string>;
  onChange: (tags: ReadonlySet<string>) => void;
}) {
  const { t } = useTranslation();
  const toggle = (tag: string) => {
    const next = new Set(chosen);
    if (next.has(tag)) next.delete(tag);
    else next.add(tag);
    onChange(next);
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={chosen.size > 0 ? "secondary" : "ghost"}
          size="icon-sm"
          className="relative rounded-full"
          aria-label={
            chosen.size > 0
              ? t("timelines.filter.active", { count: chosen.size })
              : t("timelines.filter.label")
          }
          title={t("timelines.filter.label")}
        >
          <ListFilter />
          {chosen.size > 0 ? (
            <span
              aria-hidden
              className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground"
            >
              {chosen.size}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-64">
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-sm font-medium">{t("timelines.filter.title")}</legend>
          {all.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("timelines.filter.none")}</p>
          ) : (
            all.map((tag) => (
              <label
                key={tag}
                className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-accent"
              >
                <input
                  type="checkbox"
                  checked={chosen.has(tag)}
                  onChange={() => toggle(tag)}
                  className="accent-primary"
                />
                {tag}
              </label>
            ))
          )}
          {chosen.size > 0 ? (
            <Button
              variant="ghost"
              size="xs"
              className="mt-1 self-start"
              onClick={() => onChange(new Set())}
            >
              {t("timelines.filter.clear")}
            </Button>
          ) : null}
        </fieldset>
      </PopoverContent>
    </Popover>
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
