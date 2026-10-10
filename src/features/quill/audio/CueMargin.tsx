import { type Editor, useEditorState } from "@tiptap/react";
import { AudioLines, Music2, Pause, Play, Repeat, Trash2 } from "lucide-react";
import { type RefObject, useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { useAssets } from "@/features/media";
import type { AudioCue } from "@/lib/bindings";
import { cuePositions, removeCueMark } from "./cueMark";
import { useListen } from "./listen";
import { SoundPickerDialog } from "./SoundPickerDialog";
import { useDeleteCue, useUpdateCue } from "./useCues";

/** The name of each sound of the library, by id (a missing one has none). */
export function useSoundNames(): Map<string, string> {
  const sounds = useAssets({ kind: "audio", search: null });
  return new Map((sounds.data ?? []).map((asset) => [asset.id, asset.name]));
}

type Props = {
  editor: Editor;
  draftId: string;
  cues: AudioCue[];
  /** The box the icons are placed in (the text's column). */
  box: RefObject<HTMLDivElement | null>;
  openId: string | null;
  onOpen: (id: string | null) => void;
};

/**
 * The sounds of a text, in its right margin (mode Audio): an icon at the
 * height of each passage with a sound, which opens the sound to hear it,
 * set its volume and loop, change it or delete it.
 */
export function CueMargin({ editor, draftId, cues, box, openId, onOpen }: Props) {
  const { t } = useTranslation();
  const names = useSoundNames();
  const positions = useEditorState({
    editor,
    selector: ({ editor: current }) => cuePositions(current),
    equalityFn: (a, b) =>
      b !== null && a.length === b.length && a.every((item, index) => item.from === b[index]?.from),
  });
  // Heights follow the layout: read again when the box changes size.
  const [, setTick] = useState(0);
  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setTick((tick) => tick + 1));
    observer.observe(element);
    return () => observer.disconnect();
  }, [box]);

  const top = (from: number) => {
    const element = box.current;
    if (!element || editor.isDestroyed) return 0;
    try {
      return editor.view.coordsAtPos(from).top - element.getBoundingClientRect().top;
    } catch {
      return 0;
    }
  };

  // Two sounds starting on one line: the second icon goes a little lower.
  let previous = Number.NEGATIVE_INFINITY;
  return (
    <>
      {positions.map(({ cueId, from }) => {
        const cue = cues.find((candidate) => candidate.id === cueId);
        if (!cue) return null;
        const name = (cue.assetId && names.get(cue.assetId)) || t("quill.audio.missing");
        const Icon = cue.kind === "ambience" ? AudioLines : Music2;
        const at = Math.max(top(from), previous + 30);
        previous = at;
        return (
          <Popover
            key={cueId}
            open={openId === cueId}
            onOpenChange={(open) => onOpen(open ? cueId : null)}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={t(`quill.audio.open.${cue.kind}`, { name })}
                className="absolute -right-8 flex size-7 items-center justify-center rounded-md text-primary outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
                style={{ top: at }}
              >
                <Icon aria-hidden className="size-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="left" align="start" className="w-72 p-3">
              <CueEditor
                editor={editor}
                draftId={draftId}
                cue={cue}
                name={name}
                missing={!cue.assetId || !names.has(cue.assetId)}
                onDeleted={() => onOpen(null)}
              />
            </PopoverContent>
          </Popover>
        );
      })}
    </>
  );
}

function CueEditor({
  editor,
  draftId,
  cue,
  name,
  missing,
  onDeleted,
}: {
  editor: Editor;
  draftId: string;
  cue: AudioCue;
  name: string;
  missing: boolean;
  onDeleted: () => void;
}) {
  const { t } = useTranslation();
  const volumeId = useId();
  const loopId = useId();
  const [volume, setVolume] = useState(cue.volume);
  const [picking, setPicking] = useState(false);
  const update = useUpdateCue(draftId);
  const remove = useDeleteCue(draftId);
  const listen = useListen();
  const playing = cue.assetId !== null && listen.playing === cue.assetId;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={missing}
          aria-label={t(playing ? "quill.audio.stop" : "quill.audio.listen", { name })}
          onClick={() => cue.assetId && void listen.toggle(cue.assetId, volume)}
        >
          {playing ? <Pause /> : <Play />}
        </Button>
        <div className="flex min-w-0 flex-col">
          <span className="text-xs font-bold text-muted-foreground">
            {t(`quill.audio.kind.${cue.kind}`)}
          </span>
          <span className={missing ? "truncate text-sm text-destructive" : "truncate text-sm"}>
            {name}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={volumeId} className="text-xs text-muted-foreground">
          {t("quill.audio.volume", { volume })}
        </label>
        <input
          id={volumeId}
          type="range"
          min={0}
          max={100}
          step={5}
          value={volume}
          onChange={(event) => {
            const next = Number(event.target.value);
            setVolume(next);
            listen.setVolume(next);
          }}
          onPointerUp={() => {
            if (volume !== cue.volume) update.mutate({ id: cue.id, patch: { volume } });
          }}
          onKeyUp={() => {
            if (volume !== cue.volume) update.mutate({ id: cue.id, patch: { volume } });
          }}
          className="accent-primary"
        />
      </div>
      {cue.kind === "ambience" && (
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={loopId} className="flex items-center gap-1.5 text-sm">
            <Repeat aria-hidden className="size-4" />
            {t("quill.audio.loop")}
          </label>
          <Switch
            id={loopId}
            checked={cue.looped}
            onCheckedChange={(looped) => update.mutate({ id: cue.id, patch: { looped } })}
          />
        </div>
      )}
      {(update.error ?? remove.error) && <AppErrorMessage error={update.error ?? remove.error} />}
      <div className="flex justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive"
          disabled={remove.isPending}
          onClick={() =>
            remove.mutate(cue.id, {
              onSuccess: () => {
                listen.stop();
                removeCueMark(editor, cue.id);
                onDeleted();
              },
            })
          }
        >
          <Trash2 />
          {t("quill.audio.delete")}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setPicking(true)}>
          {t("quill.audio.change")}
        </Button>
      </div>
      <SoundPickerDialog
        open={picking}
        onOpenChange={setPicking}
        title={t("quill.audio.change")}
        selectedId={cue.assetId}
        onPick={(assetId) => update.mutate({ id: cue.id, patch: { assetId } })}
      />
    </div>
  );
}
