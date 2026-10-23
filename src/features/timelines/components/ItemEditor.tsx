import { Link, useParams } from "@tanstack/react-router";
import {
  CalendarDays,
  ChevronRight,
  ExternalLink,
  Eye,
  EyeOff,
  ImagePlus,
  Plus,
  Trash2,
  Unlink,
  X,
} from "lucide-react";
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
import { AssetImage, ImagePickerDialog } from "@/features/media";
import type { Card, Timeline, TimelineItem, WorldCalendar } from "@/lib/bindings";
import { cn } from "@/lib/utils";
import { formatDate } from "../calendar";
import { shiftDay } from "../edit";
import { MAX_DESCRIPTION, MAX_NAME, MAX_TAG, MAX_TAGS } from "../limits";
import { useCalendarWords } from "../useCalendar";
import { DateField, type DateValue } from "./DateField";

type Props = {
  item: TimelineItem;
  timeline: Timeline;
  calendar: WorldCalendar;
  card: Card | undefined;
  onSave: (item: TimelineItem) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  /** Where the card floats: away from the item it shows. */
  side?: "left" | "right";
  /** The lives covering the item's date (its cards' ages then), oldest first. */
  lives?: { id: string; name: string; imageAssetId: string | null; age: number }[];
  /** Selects another item (a life, an item it leads to…). */
  onSelectItem?: (id: string) => void;
  /** Cause and effect: what it leads to, what leads to it, what it could lead to. */
  leadsTo?: { linkId: string; id: string; name: string }[];
  comesFrom?: { linkId: string; id: string; name: string }[];
  candidates?: { id: string; name: string }[];
  onLink?: (to: string) => void;
  onUnlink?: (linkId: string) => void;
};

/** A section that opens and closes, like vvd's « Étiquettes ». */
function Fold({
  label,
  children,
  defaultOpen = false,
}: {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className="border-t border-border pt-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 rounded-md py-1 text-sm font-medium outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronRight
          aria-hidden
          className={cn(
            "size-4 transition-transform motion-reduce:transition-none",
            open && "rotate-90",
          )}
        />
        {label}
      </button>
      {open ? (
        <div id={id} className="flex flex-col gap-3 pt-2 pb-1">
          {children}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The selected item, in a card floating over the timeline (after vvd,
 * 11.5b): its image, name, visibility in the wiki and deletion; its dates;
 * its description; its tags; the card it stands for; then its track and
 * colour. Each change is saved at once (texts when the field is left) and
 * can be undone.
 */
export function ItemEditor({
  item,
  timeline,
  calendar,
  card,
  onSave,
  onDelete,
  onClose,
  side = "right",
  lives = [],
  onSelectItem,
  leadsTo = [],
  comesFrom = [],
  candidates = [],
  onLink,
  onUnlink,
}: Props) {
  const { t } = useTranslation();
  const words = useCalendarWords();
  const id = useId();
  const { worldId } = useParams({ from: "/world/$worldId/world/timeline/$timelineId" });
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description);
  const [tag, setTag] = useState("");
  const [picking, setPicking] = useState(false);
  const [editingDates, setEditingDates] = useState(false);
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
  const tags = item.tags ?? [];
  const addTag = () => {
    const next = tag.trim().slice(0, MAX_TAG);
    setTag("");
    if (!next || tags.some((other) => other.toLowerCase() === next.toLowerCase())) return;
    save({ tags: [...tags, next] });
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
  const dates =
    item.end === null
      ? formatDate(calendar, item.start, item.precision, words)
      : t("timelines.editor.range", {
          start: formatDate(calendar, item.start, item.precision, words),
          end: formatDate(calendar, item.end, item.precision, words),
        });
  const image = item.imageAssetId ?? card?.imageAssetId ?? null;
  const hidden = item.hidden ?? false;

  return (
    <aside
      aria-label={t("timelines.editor.label")}
      className={cn(
        "glass-float float-in absolute top-3 z-30 flex max-h-[calc(100%-5rem)] w-[min(22rem,38%)] min-w-64 flex-col gap-3 overflow-y-auto rounded-2xl p-3 shadow-xl",
        side === "left" ? "left-3" : "right-3",
      )}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => setPicking(true)}
          aria-label={
            item.imageAssetId ? t("timelines.editor.changeImage") : t("timelines.editor.addImage")
          }
          title={
            item.imageAssetId ? t("timelines.editor.changeImage") : t("timelines.editor.addImage")
          }
          className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-secondary/70 text-muted-foreground outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
        >
          {image ? (
            <AssetImage assetId={image} alt="" className="size-full object-cover" />
          ) : (
            <ImagePlus aria-hidden className="size-6" />
          )}
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-0.5">
            <label htmlFor={`${id}-title`} className="sr-only">
              {t("timelines.editor.title")}
            </label>
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
              className="h-8 border-transparent bg-transparent px-1 text-base font-semibold shadow-none hover:border-border focus-visible:border-ring"
            />
            <Button
              variant="ghost"
              size="icon-xs"
              aria-pressed={hidden}
              aria-label={hidden ? t("timelines.editor.show") : t("timelines.editor.hide")}
              title={hidden ? t("timelines.editor.show") : t("timelines.editor.hide")}
              onClick={() => save({ hidden: !hidden })}
            >
              {hidden ? <EyeOff /> : <Eye />}
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={t("timelines.editor.delete")}
              title={t("timelines.editor.delete")}
              onClick={() => onDelete(item.id)}
            >
              <Trash2 />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={t("timelines.details.close")}
              title={t("timelines.details.close")}
              onClick={onClose}
            >
              <X />
            </Button>
          </div>
          <button
            type="button"
            aria-expanded={editingDates}
            onClick={() => setEditingDates(!editingDates)}
            className="flex items-center gap-1.5 self-start rounded-md px-1 py-0.5 text-sm text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            title={t("timelines.editor.editDates")}
          >
            <CalendarDays aria-hidden className="size-4" />
            {dates}
          </button>
        </div>
      </div>

      {editingDates ? (
        <div className="flex flex-col gap-3 rounded-xl bg-secondary/40 p-2">
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
          {item.end !== null && card ? (
            <div className="flex items-center gap-2">
              <Switch
                id={`${id}-life`}
                checked={item.life ?? false}
                onCheckedChange={(life) => save({ life })}
              />
              <Label htmlFor={`${id}-life`}>
                {t("timelines.editor.life", { name: card.title })}
              </Label>
            </div>
          ) : null}
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
        </div>
      ) : null}

      <div>
        <label htmlFor={`${id}-description`} className="sr-only">
          {t("timelines.editor.description")}
        </label>
        <textarea
          id={`${id}-description`}
          value={description}
          maxLength={MAX_DESCRIPTION}
          rows={4}
          placeholder={t("timelines.editor.description")}
          onChange={(event) => setDescription(event.target.value)}
          onBlur={saveDescription}
          className="min-h-24 w-full rounded-xl border border-transparent bg-secondary/50 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </div>

      {lives.length > 0 ? (
        <Fold label={t("timelines.editor.lives")} defaultOpen>
          <ul aria-label={t("timelines.editor.lives")} className="flex flex-col gap-1">
            {lives.map((life) => (
              <li key={life.id}>
                <button
                  type="button"
                  onClick={() => onSelectItem?.(life.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left text-sm outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {life.imageAssetId ? (
                    <AssetImage
                      assetId={life.imageAssetId}
                      alt=""
                      className="size-6 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span aria-hidden className="size-6 shrink-0 rounded-full bg-secondary" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{life.name}</span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    {life.age < 1
                      ? t("timelines.editor.newborn")
                      : t("timelines.editor.age", { count: life.age })}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Fold>
      ) : null}

      <Fold
        label={t("timelines.editor.causes")}
        defaultOpen={leadsTo.length > 0 || comesFrom.length > 0}
      >
        {[
          { key: "to", label: t("timelines.editor.leadsTo"), links: leadsTo },
          { key: "from", label: t("timelines.editor.comesFrom"), links: comesFrom },
        ].map((group) =>
          group.links.length === 0 ? null : (
            <div key={group.key} className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">{group.label}</span>
              <ul aria-label={group.label} className="flex flex-col gap-0.5">
                {group.links.map((link) => (
                  <li key={link.linkId} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onSelectItem?.(link.id)}
                      className="min-w-0 flex-1 truncate rounded-md px-1.5 py-1 text-left text-sm outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {link.name}
                    </button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={t("timelines.editor.unlinkItem", { name: link.name })}
                      onClick={() => onUnlink?.(link.linkId)}
                    >
                      <X />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ),
        )}
        {candidates.length > 0 ? (
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${id}-lead`}>{t("timelines.editor.addLead")}</Label>
            <Select value="" onValueChange={(to) => onLink?.(to)}>
              <SelectTrigger id={`${id}-lead`}>
                <SelectValue placeholder={t("timelines.editor.chooseLead")} />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((candidate) => (
                  <SelectItem key={candidate.id} value={candidate.id}>
                    {candidate.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </Fold>

      <Fold label={t("timelines.editor.tags")} defaultOpen={tags.length > 0}>
        {tags.length > 0 ? (
          <ul aria-label={t("timelines.editor.tags")} className="flex flex-wrap gap-1">
            {tags.map((each) => (
              <li
                key={each}
                className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs"
              >
                {each}
                <button
                  type="button"
                  aria-label={t("timelines.editor.removeTag", { tag: each })}
                  onClick={() => save({ tags: tags.filter((other) => other !== each) })}
                  className="rounded-full outline-none hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X aria-hidden className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <form
          className="flex gap-1"
          onSubmit={(event) => {
            event.preventDefault();
            addTag();
          }}
        >
          <label htmlFor={`${id}-tag`} className="sr-only">
            {t("timelines.editor.newTag")}
          </label>
          <Input
            id={`${id}-tag`}
            value={tag}
            maxLength={MAX_TAG}
            placeholder={t("timelines.editor.newTag")}
            onChange={(event) => setTag(event.target.value)}
            className="h-8"
          />
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            disabled={!tag.trim() || tags.length >= MAX_TAGS}
          >
            {t("timelines.editor.addTag")}
          </Button>
        </form>
      </Fold>

      <Fold label={t("timelines.editor.more")}>
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
        {item.imageAssetId ? (
          <Button
            variant="ghost"
            size="xs"
            className="self-start"
            onClick={() => save({ imageAssetId: null })}
          >
            <X />
            {t("timelines.editor.removeImage")}
          </Button>
        ) : null}
      </Fold>

      {card ? (
        <div className="flex items-center gap-1 border-t border-border pt-2">
          <Button asChild variant="secondary" size="sm" className="min-w-0 flex-1 justify-start">
            <Link to="/world/$worldId/world/card/$cardId" params={{ worldId, cardId: card.id }}>
              <ExternalLink />
              <span className="truncate">{card.title}</span>
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("timelines.editor.unlink")}
            title={t("timelines.editor.unlink")}
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
          <Button
            variant="ghost"
            size="sm"
            className="w-full rounded-xl border border-dashed border-border-strong"
          >
            <Plus />
            {t("timelines.editor.link")}
          </Button>
        </CardPicker>
      )}

      <ImagePickerDialog
        open={picking}
        onOpenChange={setPicking}
        selectedId={item.imageAssetId ?? null}
        onPick={(assetId) => save({ imageAssetId: assetId })}
      />
    </aside>
  );
}
