import { Link, useParams } from "@tanstack/react-router";
import { ExternalLink, Link2, Trash2, Unlink, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ChoiceTiles, colorLabel, TYPE_COLORS, typeColor } from "@/features/card-types";
import { CardPicker } from "@/features/cards";
import { AssetImage } from "@/features/media";
import type { Card, Timeline, TimelineItem, WorldCalendar } from "@/lib/bindings";
import { shiftDay } from "../edit";
import { MAX_DESCRIPTION, MAX_NAME } from "../limits";
import { DateField, type DateValue } from "./DateField";

type Props = {
  item: TimelineItem;
  timeline: Timeline;
  calendar: WorldCalendar;
  card: Card | undefined;
  onSave: (item: TimelineItem) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
};

/**
 * The selected item, to edit (11.4): its name, dates (a period has an
 * end), track, colour, description and the card it stands for. Each
 * change is saved at once (names and descriptions when the field is left),
 * and can be undone.
 */
export function ItemEditor({ item, timeline, calendar, card, onSave, onDelete, onClose }: Props) {
  const { t } = useTranslation();
  const id = useId();
  const { worldId } = useParams({ from: "/world/$worldId/world/timeline/$timelineId" });
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description);
  // Undo, redo or a drag change the item: the fields follow.
  useEffect(() => setTitle(item.title), [item.title]);
  useEffect(() => setDescription(item.description), [item.description]);
  const save = (patch: Partial<TimelineItem>) => onSave({ ...item, ...patch });
  const saveTitle = () => {
    if (title.trim() !== item.title) save({ title: title.trim() });
  };
  const saveDescription = () => {
    if (description !== item.description) save({ description });
  };

  const start: DateValue = { days: item.start, precision: item.precision };
  const end: DateValue | null =
    item.end === null ? null : { days: item.end, precision: item.precision };
  const [badEnd, setBadEnd] = useState(false);
  const setStart = (value: DateValue) => {
    setBadEnd(false);
    // The end keeps the period's length, and its precision follows.
    const length = item.end === null ? null : item.end - item.start;
    save({
      start: value.days,
      end: length === null ? null : value.days + length,
      precision: value.precision,
    });
  };
  const setEnd = (value: DateValue) => {
    if (value.days < item.start) {
      setBadEnd(true);
      return;
    }
    setBadEnd(false);
    save({ end: value.days, precision: value.precision });
  };

  return (
    <aside
      aria-label={t("timelines.editor.label")}
      className="flex w-80 shrink-0 flex-col gap-4 overflow-y-auto rounded-lg border border-border bg-background/60 p-3"
    >
      <div className="flex items-start gap-2">
        {card?.imageAssetId ? (
          <AssetImage
            assetId={card.imageAssetId}
            alt=""
            className="size-10 shrink-0 rounded-md object-cover"
          />
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Label htmlFor={`${id}-title`}>{t("timelines.editor.title")}</Label>
          <Input
            id={`${id}-title`}
            value={title}
            maxLength={MAX_NAME}
            placeholder={card?.title ?? t("timelines.editor.titlePlaceholder")}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={saveTitle}
            onKeyDown={(event) => {
              if (event.key === "Enter") saveTitle();
            }}
          />
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("timelines.details.close")}
          onClick={onClose}
        >
          <X />
        </Button>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">{t("timelines.editor.card")}</span>
        {card ? (
          <div className="flex items-center gap-1">
            <Button asChild variant="secondary" size="xs" className="min-w-0 flex-1 justify-start">
              <Link to="/world/$worldId/world/card/$cardId" params={{ worldId, cardId: card.id }}>
                <ExternalLink />
                <span className="truncate">{card.title}</span>
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={t("timelines.editor.unlink")}
              onClick={() => save({ cardId: null, title: item.title || card.title })}
            >
              <Unlink />
            </Button>
          </div>
        ) : (
          <CardPicker
            label={t("timelines.editor.searchCard")}
            allowedTypeIds={[]}
            onPick={(cardId) => save({ cardId })}
          >
            <Button variant="secondary" size="xs" className="self-start">
              <Link2 />
              {t("timelines.editor.link")}
            </Button>
          </CardPicker>
        )}
      </div>

      <DateField
        legend={item.end === null ? t("timelines.editor.date") : t("timelines.editor.start")}
        calendar={calendar}
        value={start}
        onChange={setStart}
      />
      <div className="flex items-center gap-2">
        <Switch
          id={`${id}-period`}
          checked={item.end !== null}
          onCheckedChange={(period) =>
            save({ end: period ? shiftDay(calendar, item.start, item.precision, 1) : null })
          }
        />
        <Label htmlFor={`${id}-period`}>{t("timelines.editor.period")}</Label>
      </div>
      {end ? (
        <div className="flex flex-col gap-1">
          <DateField
            legend={t("timelines.editor.end")}
            calendar={calendar}
            value={end}
            onChange={setEnd}
          />
          {badEnd ? (
            <p role="alert" className="text-xs text-destructive">
              {t("timelines.editor.endBeforeStart")}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-1">
        <Label htmlFor={`${id}-track`}>{t("timelines.editor.track")}</Label>
        <Select value={item.trackId} onValueChange={(trackId) => save({ trackId })}>
          <SelectTrigger id={`${id}-track`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {timeline.tracks.map((track) => (
              <SelectItem key={track.id} value={track.id}>
                {track.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ChoiceTiles
        label={t("timelines.editor.color")}
        value={item.color}
        onChange={(color) => save({ color })}
        className="grid grid-cols-9 gap-1"
        tileClassName="size-5 rounded-full"
        choices={TYPE_COLORS.map((color) => ({
          value: color,
          label: t(colorLabel(color)),
          content: (
            <span
              aria-hidden
              className="size-full rounded-full"
              style={{ backgroundColor: typeColor(color) }}
            />
          ),
        }))}
      />

      <div className="flex flex-col gap-1">
        <Label htmlFor={`${id}-description`}>{t("timelines.editor.description")}</Label>
        <textarea
          id={`${id}-description`}
          value={description}
          maxLength={MAX_DESCRIPTION}
          rows={4}
          onChange={(event) => setDescription(event.target.value)}
          onBlur={saveDescription}
          className="min-h-20 rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="self-start text-destructive"
        onClick={() => onDelete(item.id)}
      >
        <Trash2 />
        {t("timelines.editor.delete")}
      </Button>
    </aside>
  );
}
