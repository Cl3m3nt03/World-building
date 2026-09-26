import { documentDir, join } from "@tauri-apps/api/path";
import { open as pickFolder } from "@tauri-apps/plugin-dialog";
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
import { useCreateWorld } from "../hooks/useWorlds";

/** Suggested location for new worlds: Documents\BuilderZ. */
async function defaultParentDir(): Promise<string> {
  return join(await documentDir(), "BuilderZ");
}

type CreateWorldDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateWorldDialog({ open, onOpenChange }: CreateWorldDialogProps) {
  const { t } = useTranslation();
  const createWorld = useCreateWorld();
  const [name, setName] = useState("");
  const [parentDir, setParentDir] = useState<string>();
  const nameId = useId();
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
    createWorld.mutate({ parentDir, name }, { onSuccess: () => onOpenChange(false) });
  };

  const changeOpen = (next: boolean) => {
    if (!next) {
      setName("");
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
