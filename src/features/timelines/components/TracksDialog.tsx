import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ChoiceTiles, colorLabel, TYPE_COLORS, typeColor } from "@/features/card-types";
import type { Timeline, TimelineTrack } from "@/lib/bindings";
import type { TimelineEditor } from "../hooks/useTimelineEditor";
import { MAX_NAME, MAX_TRACKS } from "../limits";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  timeline: Timeline;
  editor: TimelineEditor;
};

/**
 * The tracks of a timeline (11.4): renamed, coloured, moved up or down,
 * added and deleted (a track holding items asks first; a timeline keeps
 * one track).
 */
export function TracksDialog({ open, onOpenChange, timeline, editor }: Props) {
  const { t } = useTranslation();
  const id = useId();
  const [name, setName] = useState("");
  const add = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    // A new track takes the next colour of the palette.
    const color = TYPE_COLORS[timeline.tracks.length % TYPE_COLORS.length] ?? "slate";
    void editor.addTrack(trimmed, color);
    setName("");
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("timelines.tracks.title")}</DialogTitle>
          <DialogDescription>{t("timelines.tracks.description")}</DialogDescription>
        </DialogHeader>
        {editor.error ? <AppErrorMessage error={editor.error} /> : null}
        <ol className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
          {timeline.tracks.map((track, index) => (
            <TrackRow
              key={track.id}
              track={track}
              index={index}
              count={timeline.tracks.length}
              items={timeline.items.filter((item) => item.trackId === track.id).length}
              editor={editor}
            />
          ))}
        </ol>
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            add();
          }}
        >
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor={`${id}-new`} className="text-xs text-muted-foreground">
              {t("timelines.tracks.newName")}
            </label>
            <Input
              id={`${id}-new`}
              value={name}
              maxLength={MAX_NAME}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <Button
            type="submit"
            variant="secondary"
            disabled={!name.trim() || timeline.tracks.length >= MAX_TRACKS}
          >
            <Plus />
            {t("timelines.tracks.add")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TrackRow({
  track,
  index,
  count,
  items,
  editor,
}: {
  track: TimelineTrack;
  index: number;
  count: number;
  items: number;
  editor: TimelineEditor;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [name, setName] = useState(track.name);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => setName(track.name), [track.name]);
  const rename = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== track.name) {
      void editor.apply({ kind: "track", id: track.id, name: trimmed, color: track.color });
    } else {
      setName(track.name);
    }
  };
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border p-2">
      <div className="flex items-center gap-1">
        <span
          aria-hidden
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: typeColor(track.color) }}
        />
        <label htmlFor={`${id}-name`} className="sr-only">
          {t("timelines.tracks.name", { number: index + 1 })}
        </label>
        <Input
          id={`${id}-name`}
          value={name}
          maxLength={MAX_NAME}
          onChange={(event) => setName(event.target.value)}
          onBlur={rename}
          onKeyDown={(event) => {
            if (event.key === "Enter") rename();
          }}
          className="h-8 flex-1"
        />
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={index === 0}
          aria-label={t("timelines.tracks.up", { name: track.name })}
          onClick={() => editor.apply({ kind: "moveTrack", id: track.id, index: index - 1 })}
        >
          <ArrowUp />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={index === count - 1}
          aria-label={t("timelines.tracks.down", { name: track.name })}
          onClick={() => editor.apply({ kind: "moveTrack", id: track.id, index: index + 1 })}
        >
          <ArrowDown />
        </Button>
        {confirming ? (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              setConfirming(false);
              void editor.deleteTrack(track.id);
            }}
          >
            {t("timelines.tracks.confirmDelete", { count: items })}
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={count <= 1}
            aria-label={t("timelines.tracks.delete", { name: track.name })}
            onClick={() => (items > 0 ? setConfirming(true) : void editor.deleteTrack(track.id))}
          >
            <Trash2 />
          </Button>
        )}
      </div>
      <ChoiceTiles
        label={t("timelines.tracks.color", { name: track.name })}
        value={track.color}
        onChange={(color) => editor.apply({ kind: "track", id: track.id, name: track.name, color })}
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
    </li>
  );
}
