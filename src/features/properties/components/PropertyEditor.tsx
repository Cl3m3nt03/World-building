import { Hash, Link2, Trash2, Type } from "lucide-react";
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
import { useRelationTypes } from "@/features/trees/hooks/useTrees";
import { relationName } from "@/features/trees/relations";
import type { CardType, PropertyDefinition, PropertyKind } from "@/lib/bindings";
import {
  useDeleteProperty,
  usePropertyValueCount,
  useRenameProperty,
  useSetPropertyKind,
  useSetPropertyRelation,
} from "../hooks/useProperties";

/** The Select's value for « just a link » (a Select item cannot be empty). */
const NO_RELATION = "none";

/** Kinds a property can have. */
export const PROPERTY_KINDS: PropertyKind[] = ["text", "number", "card", "cards"];

export function kindIcon(kind: PropertyKind) {
  if (kind === "number") return Hash;
  if (kind === "card" || kind === "cards") return Link2;
  return Type;
}

function isLink(kind: PropertyKind) {
  return kind === "card" || kind === "cards";
}

/**
 * Small window to edit a property: its name, its kind and a delete button
 * that says how many values would be lost. `children` is the trigger.
 */
export function PropertyEditor({
  property,
  types,
  children,
  defaultOpen = false,
}: {
  property: PropertyDefinition;
  /** Card types, for the targets of a link property. */
  types: CardType[];
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(defaultOpen);
  const [label, setLabel] = useState(property.label);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const rename = useRenameProperty();
  const setKind = useSetPropertyKind();
  const setRelation = useSetPropertyRelation();
  const relationTypes = useRelationTypes();
  const relationId = useId();
  const chosenRelation = relationTypes.data?.find((type) => type.id === property.relationTypeId);
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

  const error = rename.error ?? setKind.error ?? setRelation.error ?? remove.error;

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
            // The name comes selected: typing replaces « New property ».
            onFocus={(event) => event.currentTarget.select()}
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
              {PROPERTY_KINDS.map((kind) => (
                <SelectItem key={kind} value={kind}>
                  {t(`properties.kinds.${kind}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{t("properties.kindHint")}</p>
        </div>
        {isLink(property.kind) && (
          <fieldset className="flex flex-col gap-1 border-0">
            <legend className="mb-1 text-xs font-bold text-muted-foreground">
              {t("properties.targets")}
            </legend>
            <p className="text-xs text-muted-foreground">{t("properties.targetsHint")}</p>
            <div className="flex max-h-40 flex-col gap-0.5 overflow-y-auto">
              {types
                .filter((type) => type.parentId === null)
                .map((type) => {
                  const checked = property.targetTypeIds.includes(type.id);
                  return (
                    <label
                      key={type.id}
                      className="flex items-center gap-2 rounded-sm px-1 py-0.5 text-sm hover:bg-accent"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        className="accent-primary"
                        onChange={() =>
                          setKind.mutate({
                            id: property.id,
                            kind: property.kind,
                            targets: checked
                              ? property.targetTypeIds.filter((id) => id !== type.id)
                              : [...property.targetTypeIds, type.id],
                          })
                        }
                      />
                      {type.name}
                    </label>
                  );
                })}
            </div>
          </fieldset>
        )}
        {isLink(property.kind) && (
          <div className="flex flex-col gap-1">
            <label htmlFor={relationId} className="text-xs font-bold text-muted-foreground">
              {t("properties.relation")}
            </label>
            <Select
              value={property.relationTypeId ?? NO_RELATION}
              onValueChange={(value) =>
                setRelation.mutate({
                  id: property.id,
                  relationTypeId: value === NO_RELATION ? null : value,
                })
              }
            >
              <SelectTrigger id={relationId} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_RELATION}>{t("properties.relationNone")}</SelectItem>
                {(relationTypes.data ?? []).map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {relationName(type, t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {property.relationTypeId
                ? t("properties.relationHint", {
                    name: property.label,
                    relation: chosenRelation
                      ? relationName(chosenRelation, t).toLocaleLowerCase()
                      : "",
                  })
                : t("properties.relationNoneHint")}
            </p>
          </div>
        )}
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
