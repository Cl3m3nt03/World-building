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
import type { Asset } from "@/lib/bindings";
import { useAssetUsages, useDeleteAsset, useRenameAsset } from "../hooks/useManageAsset";

type DialogProps = { asset: Asset | null; onClose: () => void };

/** Renames an asset; the file keeps its hash name. */
export function RenameAssetDialog({ asset, onClose }: DialogProps) {
  const { t } = useTranslation();
  const rename = useRenameAsset();
  const [name, setName] = useState("");
  const inputId = useId();

  useEffect(() => {
    if (asset) setName(asset.name);
  }, [asset]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!asset || name.trim() === "") return;
    rename.mutate({ id: asset.id, name }, { onSuccess: onClose });
  };

  return (
    <Dialog
      open={asset !== null}
      onOpenChange={(open) => {
        if (!open) {
          rename.reset();
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t("media.renameTitle")}</DialogTitle>
            <DialogDescription>{t("media.renameDescription")}</DialogDescription>
          </DialogHeader>
          <label htmlFor={inputId} className="sr-only">
            {t("media.nameLabel")}
          </label>
          <Input
            id={inputId}
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
            maxLength={200}
          />
          {rename.isError && <AppErrorMessage error={rename.error} />}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {t("createWorld.cancel")}
            </Button>
            <Button type="submit" disabled={name.trim() === "" || rename.isPending}>
              {t("media.rename")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Deletes an asset after confirmation, saying where it is still used. */
export function DeleteAssetDialog({ asset, onClose }: DialogProps) {
  const { t } = useTranslation();
  const remove = useDeleteAsset();
  const usages = useAssetUsages(asset?.id ?? null);
  const used = (usages.data ?? []).length > 0;

  return (
    <Dialog
      open={asset !== null}
      onOpenChange={(open) => {
        if (!open) {
          remove.reset();
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("media.deleteTitle", { name: asset?.name ?? "" })}</DialogTitle>
          <DialogDescription>{t("media.deleteDescription")}</DialogDescription>
        </DialogHeader>
        {used && (
          <div
            role="alert"
            className="flex flex-col gap-1 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm"
          >
            <p className="font-medium">{t("media.deleteUsed")}</p>
            <ul className="list-disc pl-5">
              {usages.data?.map((usage) => (
                <li key={usage.kind}>
                  {t("media.usage.worldMainImage", { name: usage.worldName })}
                </li>
              ))}
            </ul>
          </div>
        )}
        {remove.isError && <AppErrorMessage error={remove.error} />}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("createWorld.cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={remove.isPending || usages.isPending}
            onClick={() => {
              if (asset) remove.mutate(asset.id, { onSuccess: onClose });
            }}
          >
            {used ? t("media.deleteAnyway") : t("media.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
