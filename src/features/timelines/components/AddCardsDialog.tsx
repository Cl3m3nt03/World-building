import { useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { typeColor, typeIcon, useCardTypes } from "@/features/card-types";
import type { Card, Timeline, TimelineItem, WorldCalendar } from "@/lib/bindings";
import { DateField, type DateValue } from "./DateField";

/** Most cards listed at once (the search narrows them). */
const MAX_LISTED = 200;

/** Mounted when opened: it starts from the view each time. */
type Props = {
  onClose: () => void;
  timeline: Timeline;
  calendar: WorldCalendar;
  cards: Card[];
  /** Where the dialog starts: the track and the date in view. */
  trackId: string;
  date: DateValue;
  /** The new items, one per card, saved as one change. */
  onPlace: (items: TimelineItem[]) => void;
};

/**
 * « Ajouter des cartes » (11.5): cards chosen in a searchable list, placed
 * as events on one track at one date. Each item stands for its card and
 * takes its name.
 */
export function AddCardsDialog({
  onClose,
  timeline,
  calendar,
  cards,
  trackId: initialTrack,
  date: initialDate,
  onPlace,
}: Props) {
  const { t } = useTranslation();
  const id = useId();
  const types = useCardTypes();
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  const [trackId, setTrackId] = useState(initialTrack);
  const [date, setDate] = useState(initialDate);
  const onTimeline = useMemo(
    () => new Set(timeline.items.flatMap((item) => (item.cardId ? [item.cardId] : []))),
    [timeline.items],
  );
  const listed = useMemo(() => {
    const words = query.trim().toLocaleLowerCase();
    return cards
      .filter(
        (card) =>
          words === "" ||
          [card.title, ...card.aliases].some((name) => name.toLocaleLowerCase().includes(words)),
      )
      .sort((a, b) => a.title.localeCompare(b.title))
      .slice(0, MAX_LISTED);
  }, [cards, query]);

  const toggle = (cardId: string) =>
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  const track = timeline.tracks.find((each) => each.id === trackId) ?? timeline.tracks[0];
  const place = () => {
    if (!track) return;
    onPlace(
      [...chosen].map((cardId) => ({
        id: crypto.randomUUID(),
        trackId: track.id,
        cardId,
        title: "",
        color: track.color,
        description: "",
        start: date.days,
        end: null,
        precision: date.precision,
      })),
    );
    onClose();
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("timelines.addCards.title")}</DialogTitle>
          <DialogDescription>{t("timelines.addCards.description")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${id}-search`}>{t("timelines.addCards.search")}</Label>
          <Input
            id={`${id}-search`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <fieldset className="flex flex-col gap-1">
          <legend className="sr-only">{t("timelines.addCards.cards")}</legend>
          <ul className="flex max-h-64 flex-col gap-0.5 overflow-y-auto rounded-md border border-border p-1">
            {listed.length === 0 ? (
              <li className="p-3 text-sm text-muted-foreground">{t("timelines.addCards.none")}</li>
            ) : (
              listed.map((card) => {
                const type = types.data?.find((each) => each.id === card.typeId);
                const Icon = typeIcon(type?.icon ?? "shapes");
                return (
                  <li key={card.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent">
                      <input
                        type="checkbox"
                        checked={chosen.has(card.id)}
                        onChange={() => toggle(card.id)}
                        className="accent-primary"
                      />
                      <Icon
                        aria-hidden
                        className="size-4 shrink-0"
                        style={{ color: typeColor(type?.color ?? "slate") }}
                      />
                      <span className="min-w-0 flex-1 truncate">{card.title}</span>
                      {onTimeline.has(card.id) ? (
                        <span className="text-xs text-muted-foreground">
                          {t("timelines.addCards.already")}
                        </span>
                      ) : null}
                    </label>
                  </li>
                );
              })
            )}
          </ul>
        </fieldset>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${id}-track`}>{t("timelines.editor.track")}</Label>
            <Select value={track?.id ?? ""} onValueChange={setTrackId}>
              <SelectTrigger id={`${id}-track`} className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timeline.tracks.map((each) => (
                  <SelectItem key={each.id} value={each.id}>
                    {each.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DateField
            legend={t("timelines.editor.date")}
            calendar={calendar}
            value={date}
            onChange={setDate}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("timelines.addCards.cancel")}
          </Button>
          <Button disabled={chosen.size === 0} onClick={place}>
            {chosen.size === 0
              ? t("timelines.addCards.placeNone")
              : t("timelines.addCards.place", { count: chosen.size })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
