import {
  Building2,
  Castle,
  Cpu,
  FolderOpen,
  Heart,
  type LucideIcon,
  Rocket,
  Sparkles,
} from "lucide-react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { type CSSProperties, type FormEvent, useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Atlas } from "@/app/shell/Atlas";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { MiddleTruncate } from "@/components/MiddleTruncate";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { commands, type Genre, type Tone } from "@/lib/bindings";
import { openDialog as pickFolder } from "@/lib/dialogs";
import { errorKey, unwrap } from "@/lib/ipc";
import { DEFAULT_GENRE, GENRES, genreLabel, isGenre } from "../genres";
import { useCreateWorld } from "../hooks/useWorlds";
import { TonePicker } from "./TonePicker";

/** Suggested location for new worlds, from Rust (Documents\BuilderZ by default). */
function defaultParentDir(): Promise<string> {
  return unwrap(commands.defaultWorldsDir());
}

/** The emblem of each genre on its tile. */
const GENRE_ICONS: Record<Genre, LucideIcon> = {
  fantasy: Castle,
  scienceFiction: Rocket,
  romance: Heart,
  cyberpunk: Cpu,
  contemporary: Building2,
  other: Sparkles,
};

type CreateWorldDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * A new world (V2): its name, its genre among illustrated tiles, its folder,
 * and beside them the world as it will be, its own atlas under its name. The
 * interface picks the world's id so that this atlas is the one it keeps.
 */
export function CreateWorldDialog({ open, onOpenChange }: CreateWorldDialogProps) {
  const { t } = useTranslation();
  const createWorld = useCreateWorld();
  const [name, setName] = useState("");
  const [genre, setGenre] = useState<Genre>(DEFAULT_GENRE);
  const [tones, setTones] = useState<Tone[]>([]);
  const [parentDir, setParentDir] = useState<string>();
  const [id, setId] = useState(() => crypto.randomUUID());
  const [triedEmpty, setTriedEmpty] = useState(false);
  const nameId = useId();
  const nameErrorId = useId();
  const genreId = useId();
  const locationId = useId();
  const locationErrorId = useId();

  useEffect(() => {
    if (!open || parentDir !== undefined) return;
    defaultParentDir()
      .then(setParentDir)
      .catch((error: unknown) => console.warn("No default world location", error));
  }, [open, parentDir]);

  const chooseLocation = async () => {
    const folder = await pickFolder({
      directory: true,
      multiple: false,
      title: t("createWorld.pickerTitle"),
      ...(parentDir === undefined ? {} : { defaultPath: parentDir }),
    });
    if (typeof folder === "string") {
      setParentDir(folder);
      createWorld.reset();
    }
  };

  const nameMissing = name.trim() === "";
  const canSubmit = parentDir !== undefined && !createWorld.isPending;
  // A folder that already holds something is the location's problem: said there.
  const folderTaken =
    createWorld.isError && errorKey(createWorld.error) === "errors.world_already_exists";

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (nameMissing) {
      setTriedEmpty(true);
      return;
    }
    if (!canSubmit) return;
    // Closed through changeOpen: the dialog lives on (it is shared from the
    // app's root), so the next world starts blank, with a new id.
    createWorld.mutate(
      { parentDir, name, genre, tones, id },
      { onSuccess: () => changeOpen(false) },
    );
  };

  const changeOpen = (next: boolean) => {
    if (!next) {
      setName("");
      setGenre(DEFAULT_GENRE);
      setTones([]);
      setId(crypto.randomUUID());
      setTriedEmpty(false);
      createWorld.reset();
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="sm:max-w-3xl">
        <form onSubmit={submit} noValidate className="flex min-h-0 flex-col gap-5">
          <DialogHeader>
            <DialogTitle className="text-2xl">{t("createWorld.title")}</DialogTitle>
            <DialogDescription>{t("createWorld.description")}</DialogDescription>
          </DialogHeader>

          <DialogBody className="grid gap-6 md:grid-cols-[1fr_16rem]">
            <div className="flex min-w-0 flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label htmlFor={nameId} className="text-sm font-medium">
                  {t("createWorld.name")}
                </label>
                <Input
                  id={nameId}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t("createWorld.namePlaceholder")}
                  autoFocus
                  maxLength={200}
                  aria-invalid={triedEmpty && nameMissing}
                  aria-describedby={triedEmpty && nameMissing ? nameErrorId : undefined}
                />
                {triedEmpty && nameMissing && (
                  <p id={nameErrorId} className="text-xs text-destructive">
                    {t("createWorld.nameRequired")}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <span id={genreId} className="text-sm font-medium">
                  {t("createWorld.genre")}
                </span>
                <RadioGroupPrimitive.Root
                  aria-labelledby={genreId}
                  value={genre}
                  onValueChange={(value) => {
                    if (isGenre(value)) setGenre(value);
                  }}
                  className="grid grid-cols-3 gap-2"
                >
                  {GENRES.map(({ value, label }) => {
                    const Icon = GENRE_ICONS[value];
                    return (
                      <RadioGroupPrimitive.Item
                        key={value}
                        value={value}
                        className="flex flex-col items-center gap-1.5 rounded-md border border-border bg-(--bz-field) px-2 py-3 text-sm text-muted-foreground transition-[color,background-color,border-color,box-shadow] duration-(--bz-duration-fast) ease-atlas outline-none hover:border-[color-mix(in_oklab,var(--primary)_45%,var(--input))] hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=checked]:border-primary data-[state=checked]:bg-[color-mix(in_oklab,var(--primary)_12%,transparent)] data-[state=checked]:text-foreground"
                      >
                        <Icon aria-hidden className="size-5" strokeWidth={1.5} />
                        {t(label)}
                      </RadioGroupPrimitive.Item>
                    );
                  })}
                </RadioGroupPrimitive.Root>
                <p className="text-xs text-muted-foreground">{t("createWorld.genreHint")}</p>
              </div>

              <TonePicker value={tones} onChange={setTones} collapsed />

              <div className="flex flex-col gap-1.5">
                <label htmlFor={locationId} className="text-sm font-medium">
                  {t("createWorld.location")}
                </label>
                <div className="flex gap-2">
                  <div className="relative min-w-0 flex-1">
                    {/* The field keeps the value; the path shows cut in its middle. */}
                    <Input
                      id={locationId}
                      value={parentDir ?? ""}
                      readOnly
                      className="text-transparent selection:text-transparent"
                      aria-invalid={folderTaken}
                      aria-describedby={folderTaken ? locationErrorId : undefined}
                    />
                    <MiddleTruncate
                      text={parentDir ?? ""}
                      className="pointer-events-none absolute inset-x-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground"
                    />
                  </div>
                  <Button type="button" variant="outline" onClick={chooseLocation}>
                    <FolderOpen />
                    {t("createWorld.chooseLocation")}
                  </Button>
                </div>
                {folderTaken ? (
                  <p id={locationErrorId} className="text-xs text-destructive">
                    {t("errors.world_already_exists")}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">{t("createWorld.locationHint")}</p>
                )}
              </div>
            </div>

            {/* The world as it will be: its own atlas, its name, its genre. */}
            <figure
              aria-hidden
              className="glass-panel flex flex-col self-start overflow-hidden rounded-lg"
            >
              <div
                className="relative aspect-[4/3] overflow-hidden"
                style={
                  {
                    background: "var(--bz-backdrop-gradient)",
                    "--bz-atlas-ink": "var(--bz-atlas-ink-strong)",
                  } as CSSProperties
                }
              >
                <Atlas seed={id} still />
              </div>
              <figcaption className="flex flex-col gap-0.5 px-3 pt-2.5 pb-3">
                <span className="truncate font-heading text-lg leading-snug font-bold">
                  {name.trim() || t("createWorld.previewName")}
                </span>
                <span className="text-xs text-muted-foreground">{t(genreLabel(genre))}</span>
                <span className="mt-2 text-xs text-muted-foreground">
                  {t("createWorld.previewHint")}
                </span>
              </figcaption>
            </figure>
          </DialogBody>

          {createWorld.isError && !folderTaken && <AppErrorMessage error={createWorld.error} />}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => changeOpen(false)}>
              {t("createWorld.cancel")}
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {createWorld.isPending ? t("createWorld.creating") : t("createWorld.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
