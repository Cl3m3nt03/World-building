import { Hash, Trash2, Type } from "lucide-react";
import { type ReactNode, useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PropertyDefinition, PropertyKind } from "@/lib/bindings";
import {
  useDeleteProperty,
  usePropertyValueCount,
  useRenameProperty,
  useSetPropertyKind,
} from "../hooks/useProperties";

/** Kinds offered when editing a property (links come with M2 step 2.8). */
export const EDITABLE_KINDS: PropertyKind[] = ["text", "number"];

export function kindIcon(kind: PropertyKind) {
  return kind === "number" ? Hash : Type;
}

/**
 * Small window to edit a property: its name, its kind and a delete button
 * that says how many values would be lost. `children` is the trigger.
 */
export function PropertyEditor({
  property,
  children,
  defaultOpen = false,
}: {
  property: PropertyDefinition;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(defaultOpen);
  const [label, setLabel] = useState(property.label);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const rename = useRenameProperty();
  const setKind = useSetPropertyKind();
  const remove = useDeleteProperty();
  const valueCount = usePropertyValueCount(confirmDelete ? property.id : null);
  const labelId = useId();
  const kindId = useId();

  useEffect(() => setLabel(property.label), [property.label]);

  const saveLabel = () => {
    const trimmed = label.trim();
    if (trimmed !== "" && trimmed !== property.label) {
      rename.mutate({ id: property.id, label: trimmed });
    }
  };

  const error = rename.error ?? setKind.error ?? remove.error;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          saveLabel();
          setConfirmDelete(false);
        }
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="glass flex w-72 flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={labelId} className="text-xs font-bold text-muted-foreground">
            {t("properties.name")}
          </label>
          <Input
            id={labelId}
            value={label}
            maxLength={80}
            autoFocus
            onChange={(event) => setLabel(event.target.value)}
            onBlur={saveLabel}
            onKeyDown={(event) => {
              if (event.key === "Enter") saveLabel();
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={kindId} className="text-xs font-bold text-muted-foreground">
            {t("properties.kind")}
          </label>
          <Select
            value={property.kind}
            onValueChange={(kind) =>
              setKind.mutate({ id: property.id, kind: kind as PropertyKind, targets: [] })
            }
          >
            <SelectTrigger id={kindId} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EDITABLE_KINDS.map((kind) => (
                <SelectItem key={kind} value={kind}>
                  {t(`properties.kinds.${kind}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{t("properties.kindHint")}</p>
        </div>
        {error && <AppErrorMessage error={error} />}
        {confirmDelete ? (
          <div role="alert" className="flex flex-col gap-2 text-sm">
            <p>
              {valueCount.data === undefined
                ? t("properties.deleteAsk", { name: property.label })
                : t("properties.deleteLoses", { name: property.label, count: valueCount.data })}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                {t("createWorld.cancel")}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={remove.isPending || valueCount.isPending}
                onClick={() => remove.mutate(property.id, { onSuccess: () => setOpen(false) })}
              >
                {t("properties.delete")}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="self-center text-destructive"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 />
            {t("properties.delete")}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
