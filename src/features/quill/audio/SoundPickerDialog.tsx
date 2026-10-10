import { Pause, Play, Search, Upload } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
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
import { useAssets, useImportAsset } from "@/features/media";
import { openDialog as pickFiles } from "@/lib/dialogs";
import { cn } from "@/lib/utils";
import { useListen } from "./listen";

/** Extensions offered by the import dialog (the Rust side detects the kind). */
const AUDIO_EXTENSIONS = ["mp3", "ogg", "wav", "flac", "m4a", "aac", "opus", "webm"];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  selectedId?: string | null | undefined;
  /** Called with the chosen or imported sound; the dialog then closes. */
  onPick: (assetId: string) => void;
};

/**
 * Picks a sound of the world's media library (heard before it is chosen), or
 * imports one from the PC: an effect, an ambience, a music or a narration.
 */
export function SoundPickerDialog({ open, onOpenChange, title, selectedId, onPick }: Props) {
  const { t } = useTranslation();
  const searchId = useId();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(selectedId ?? null);
  const sounds = useAssets({ kind: "audio", search: search.trim() || null });
  const importFile = useImportAsset();
  const listen = useListen();

  // biome-ignore lint/correctness/useExhaustiveDependencies: on opening and closing only
  useEffect(() => {
    if (open) {
      setSelected(selectedId ?? null);
      setSearch("");
      importFile.reset();
    } else {
      listen.stop();
    }
  }, [open]);

  const pick = (assetId: string) => {
    listen.stop();
    onPick(assetId);
    onOpenChange(false);
  };
  const importSound = async () => {
    const chosen = await pickFiles({
      title: t("quill.audio.importTitle"),
      filters: [{ name: t("media.filter.audio"), extensions: AUDIO_EXTENSIONS }],
    });
    const path = typeof chosen === "string" ? chosen : null;
    if (!path) return;
    importFile.mutate(path, {
      onSuccess: ({ asset }) => {
        if (asset.kind === "audio") pick(asset.id);
      },
    });
  };

  const list = sounds.data ?? [];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t("quill.audio.pickerDescription")}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              aria-hidden
              className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <label htmlFor={searchId} className="sr-only">
              {t("quill.audio.search")}
            </label>
            <Input
              id={searchId}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("quill.audio.search")}
              className="pl-8"
            />
          </div>
          <Button
            variant="secondary"
            onClick={() => void importSound()}
            disabled={importFile.isPending}
          >
            <Upload />
            {t("quill.audio.import")}
          </Button>
        </div>
        {list.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t(search.trim() ? "quill.audio.noMatch" : "quill.audio.none")}
          </p>
        ) : (
          <ul
            aria-label={t("quill.audio.sounds")}
            className="flex max-h-72 flex-col gap-1 overflow-y-auto"
          >
            {list.map((asset) => {
              const playing = listen.playing === asset.id;
              return (
                <li key={asset.id} className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t(playing ? "quill.audio.stop" : "quill.audio.listen", {
                      name: asset.name,
                    })}
                    onClick={() => void listen.toggle(asset.id)}
                  >
                    {playing ? <Pause /> : <Play />}
                  </Button>
                  <button
                    type="button"
                    aria-pressed={selected === asset.id}
                    onClick={() => setSelected(asset.id)}
                    onDoubleClick={() => pick(asset.id)}
                    className={cn(
                      "flex-1 truncate rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50",
                      "aria-pressed:bg-secondary aria-pressed:font-medium",
                    )}
                  >
                    {asset.name}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {(sounds.error ?? importFile.error) && (
          <AppErrorMessage error={sounds.error ?? importFile.error} />
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("quill.cancel")}
          </Button>
          <Button disabled={!selected} onClick={() => selected && pick(selected)}>
            {t("quill.audio.choose")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
