import { Trash2 } from "lucide-react";
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
import { useDeleteWorld } from "@/features/world";
import type { WorldInfo } from "@/lib/bindings";

type DeleteWorldDialogProps = {
  world: WorldInfo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Confirmation of the world deletion: the world's name must be typed. The
 * folder goes to the Windows recycle bin, where it can be restored.
 */
export function DeleteWorldDialog({ world, open, onOpenChange }: DeleteWorldDialogProps) {
  const { t } = useTranslation();
  const remove = useDeleteWorld();
  const [typed, setTyped] = useState("");
  const inputId = useId();
  const confirmed = typed.trim() === world.name.trim();

  const { reset } = remove;
  // A new opening starts from an empty field and no error.
  useEffect(() => {
    if (open) {
      setTyped("");
      reset();
    }
  }, [open, reset]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (confirmed && !remove.isPending) remove.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !remove.isPending && onOpenChange(next)}>
      <DialogContent role="alertdialog" className="sm:max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t("worldSettings.delete.title", { name: world.name })}</DialogTitle>
            <DialogDescription>{t("worldSettings.delete.description")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={inputId} className="text-sm">
              {t("worldSettings.delete.typeName", { name: world.name })}
            </label>
            <Input
              id={inputId}
              value={typed}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setTyped(event.target.value)}
            />
          </div>
          {remove.error && <AppErrorMessage error={remove.error} />}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={remove.isPending}
            >
              {t("worldSettings.delete.cancel")}
            </Button>
            <Button type="submit" variant="destructive" disabled={!confirmed || remove.isPending}>
              <Trash2 />
              {remove.isPending
                ? t("worldSettings.delete.deleting")
                : t("worldSettings.delete.confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
