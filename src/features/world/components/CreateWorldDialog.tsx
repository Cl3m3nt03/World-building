import { FolderOpen } from "lucide-react";
import { type FormEvent, useEffect, useId, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { commands, type Genre } from "@/lib/bindings";
import { openDialog as pickFolder } from "@/lib/dialogs";
import { unwrap } from "@/lib/ipc";
import { DEFAULT_GENRE, GENRES, isGenre } from "../genres";
import { useCreateWorld } from "../hooks/useWorlds";

/** Suggested location for new worlds, from Rust (Documents\BuilderZ by default). */
function defaultParentDir(): Promise<string> {
  return unwrap(commands.defaultWorldsDir());
}

type CreateWorldDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateWorldDialog({ open, onOpenChange }: CreateWorldDialogProps) {
  const { t } = useTranslation();
  const createWorld = useCreateWorld();
  const [name, setName] = useState("");
  const [genre, setGenre] = useState<Genre>(DEFAULT_GENRE);
  const [parentDir, setParentDir] = useState<string>();
  const nameId = useId();
  const genreId = useId();
  const locationId = useId();

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
    if (typeof folder === "string") setParentDir(folder);
  };

  const canSubmit = name.trim() !== "" && parentDir !== undefined && !createWorld.isPending;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    createWorld.mutate({ parentDir, name, genre }, { onSuccess: () => onOpenChange(false) });
  };

  const changeOpen = (next: boolean) => {
    if (!next) {
      setName("");
      setGenre(DEFAULT_GENRE);
      createWorld.reset();
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t("createWorld.title")}</DialogTitle>
            <DialogDescription>{t("createWorld.description")}</DialogDescription>
          </DialogHeader>

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
              required
              maxLength={200}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={genreId} className="text-sm font-medium">
              {t("createWorld.genre")}
            </label>
            <Select
              value={genre}
              onValueChange={(value) => {
                if (isGenre(value)) setGenre(value);
              }}
            >
              <SelectTrigger id={genreId} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GENRES.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {t(label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t("createWorld.genreHint")}</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={locationId} className="text-sm font-medium">
              {t("createWorld.location")}
            </label>
            <div className="flex gap-2">
              <Input
                id={locationId}
                value={parentDir ?? ""}
                readOnly
                className="font-mono text-xs"
              />
              <Button type="button" variant="secondary" onClick={chooseLocation}>
                <FolderOpen />
                {t("createWorld.chooseLocation")}
              </Button>
            </div>
          </div>

          {createWorld.isError && <AppErrorMessage error={createWorld.error} />}

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
