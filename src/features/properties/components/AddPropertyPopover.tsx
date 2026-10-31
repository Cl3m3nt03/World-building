import { CalendarDays, Hash, Link2, ListChecks, Plus, Type } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { typeColor, typeIcon } from "@/features/card-types";
import type { CardType, PropertyDefinition, PropertyKind, PropertyOwner } from "@/lib/bindings";
import { useCreateProperty, useSetPropertyKind } from "../hooks/useProperties";

const ENTRY =
  "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none transition-colors duration-(--bz-duration-fast) ease-atlas hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";

function Family({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="rubric px-2 pt-1.5 pb-0.5">{title}</p>
      <div className="grid grid-cols-2 gap-0.5">{children}</div>
    </div>
  );
}

/**
 * « + Ajouter une propriété » (V2-3.3, after vvd): a small window with the
 * property's name first, then its kind in two families, a value (text,
 * number, select, date) or a link to a card (any card, or a card of a given
 * type; one or several). Picking a kind creates the property.
 */
export function AddPropertyPopover({
  owner,
  types,
  onCreated,
}: {
  owner: PropertyOwner;
  types: CardType[];
  onCreated?: (property: PropertyDefinition) => void;
}) {
  const { t } = useTranslation();
  const create = useCreateProperty();
  const setKind = useSetPropertyKind();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [several, setSeveral] = useState(false);
  const nameId = useId();
  const severalId = useId();
  const busy = create.isPending || setKind.isPending;

  const add = async (kind: PropertyKind, targetTypeId?: string) => {
    const label = name.trim() || t("properties.newName");
    const property = await create.mutateAsync({ owner, label, kind });
    const created = targetTypeId
      ? await setKind.mutateAsync({ id: property.id, kind, targets: [targetTypeId] })
      : property;
    setOpen(false);
    setName("");
    setSeveral(false);
    onCreated?.(created);
  };
  const link: PropertyKind = several ? "cards" : "card";
  const mainTypes = types.filter((type) => type.parentId === null);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="self-start">
          <Plus />
          {t("properties.add")}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="flex max-h-(--radix-popover-content-available-height) w-80 flex-col gap-1 overflow-y-auto p-2"
      >
        <label htmlFor={nameId} className="sr-only">
          {t("properties.nameLabel")}
        </label>
        <input
          id={nameId}
          // biome-ignore lint/a11y/noAutofocus: the window opens to name the property
          autoFocus
          value={name}
          maxLength={100}
          placeholder={t("properties.nameLabel")}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void add("text");
            }
          }}
          className="h-8 rounded-md border border-input bg-(--bz-field) px-2.5 text-sm shadow-(--bz-field-inset) outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/30"
        />
        <Family title={t("properties.families.value")}>
          <button type="button" className={ENTRY} disabled={busy} onClick={() => void add("text")}>
            <Type aria-hidden className="size-4 text-muted-foreground" />
            {t("properties.kinds.text")}
          </button>
          <button
            type="button"
            className={ENTRY}
            disabled={busy}
            onClick={() => void add("number")}
          >
            <Hash aria-hidden className="size-4 text-muted-foreground" />
            {t("properties.kinds.number")}
          </button>
          <button
            type="button"
            className={ENTRY}
            disabled={busy}
            onClick={() => void add("select")}
          >
            <ListChecks aria-hidden className="size-4 text-muted-foreground" />
            {t("properties.kinds.select")}
          </button>
          <button type="button" className={ENTRY} disabled={busy} onClick={() => void add("date")}>
            <CalendarDays aria-hidden className="size-4 text-muted-foreground" />
            {t("properties.kinds.date")}
          </button>
        </Family>
        <Family title={t("properties.families.link")}>
          <button type="button" className={ENTRY} disabled={busy} onClick={() => void add(link)}>
            <Link2 aria-hidden className="size-4 text-muted-foreground" />
            {t("properties.anyCard")}
          </button>
          {mainTypes.map((type) => {
            const Icon = typeIcon(type.icon);
            return (
              <button
                key={type.id}
                type="button"
                className={ENTRY}
                disabled={busy}
                onClick={() => void add(link, type.id)}
              >
                <Icon aria-hidden className="size-4" style={{ color: typeColor(type.color) }} />
                <span className="truncate">{type.name}</span>
              </button>
            );
          })}
        </Family>
        <div className="flex items-center gap-2 border-t border-border px-2 pt-2 pb-1">
          <input
            id={severalId}
            type="checkbox"
            checked={several}
            onChange={(event) => setSeveral(event.target.checked)}
            className="size-4 accent-(--bz-accent)"
          />
          <label htmlFor={severalId} className="text-xs text-muted-foreground">
            {t("properties.severalCards")}
          </label>
        </div>
      </PopoverContent>
    </Popover>
  );
}
