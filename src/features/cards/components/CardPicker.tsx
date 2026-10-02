import { TextCursorInput } from "lucide-react";
import { type ReactNode, useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { typeColor, typeIcon, useCardTypes } from "@/features/card-types";
import type { Card, CardType } from "@/lib/bindings";
import { cn } from "@/lib/utils";
import { useCardList } from "../hooks/useCards";

/** Most results shown at once. */
const MAX_RESULTS = 50;

/** Whether `card` is of one of `allowed` types (empty: any), a subtype counting as its type. */
export function cardAllowed(card: Card, allowed: string[], types: CardType[]): boolean {
  if (allowed.length === 0) return true;
  if (!card.typeId) return false;
  if (allowed.includes(card.typeId)) return true;
  const parent = types.find((type) => type.id === card.typeId)?.parentId;
  return parent !== null && parent !== undefined && allowed.includes(parent);
}

function matches(card: Card, query: string): boolean {
  if (query === "") return true;
  const names = [card.title, ...card.aliases].map((name) => name.toLocaleLowerCase());
  return names.some((name) => name.includes(query));
}

/**
 * Picks a card with a search on names and aliases: arrow keys move, Enter
 * picks, Escape closes. `children` is the trigger. With `onPickName`, the
 * text typed can also be kept as a plain name (last option).
 */
export function CardPicker({
  children,
  label,
  allowedTypeIds,
  excludeIds = [],
  onPick,
  onPickName,
  placeholder,
  side = "bottom",
  open: openProp,
  onOpenChange,
}: {
  children: ReactNode;
  /** Accessible name of the search field. */
  label: string;
  allowedTypeIds: string[];
  excludeIds?: string[];
  onPick: (cardId: string) => void;
  /** Side of the trigger where the picker opens (default: below). */
  side?: "top" | "bottom";
  /** Placeholder of the search field (default: a card search). */
  placeholder?: string;
  /** Keeps the typed text as a plain name instead of a card. */
  onPickName?: (name: string) => void;
  /** Opened from outside (e.g. a context menu); the picker stays usable alone. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const cards = useCardList(false);
  const types = useCardTypes();
  const [ownOpen, setOwnOpen] = useState(false);
  const open = openProp ?? ownOpen;
  const setOpen = (next: boolean) => {
    setOwnOpen(next);
    onOpenChange?.(next);
  };
  const [search, setSearch] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const all = types.data ?? [];
  const query = search.trim().toLocaleLowerCase();

  const results = useMemo(
    () =>
      (cards.data ?? [])
        .filter((card) => !excludeIds.includes(card.id))
        .filter((card) => cardAllowed(card, allowedTypeIds, all))
        .filter((card) => matches(card, query))
        .slice(0, MAX_RESULTS),
    [cards.data, excludeIds, allowedTypeIds, all, query],
  );

  const name = search.trim();
  const nameOption = onPickName !== undefined && name !== "";
  const count = results.length + (nameOption ? 1 : 0);

  const pick = (card: Card | undefined) => {
    if (!card) return;
    onPick(card.id);
    setOpen(false);
  };
  const pickName = () => {
    onPickName?.(name);
    setOpen(false);
  };
  const pickActive = () => {
    if (nameOption && active === results.length) pickName();
    else pick(results[active]);
  };
  const nameId = `${listId}-name`;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setSearch("");
          setActive(0);
        }
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" side={side} className="glass flex w-80 flex-col gap-2 p-2">
        <Input
          type="search"
          role="combobox"
          aria-label={label}
          aria-expanded
          aria-controls={listId}
          aria-activedescendant={
            results[active]
              ? `${listId}-${results[active].id}`
              : nameOption && active === results.length
                ? nameId
                : undefined
          }
          placeholder={placeholder ?? t("cards.pickerSearch")}
          value={search}
          autoFocus
          onChange={(event) => {
            setSearch(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((index) => Math.min(index + 1, count - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((index) => Math.max(index - 1, 0));
            } else if (event.key === "Enter") {
              event.preventDefault();
              pickActive();
            }
          }}
        />
        <div id={listId} role="listbox" aria-label={label} className="max-h-64 overflow-y-auto">
          {results.map((card, index) => {
            const type = all.find((candidate) => candidate.id === card.typeId);
            const Icon = typeIcon(type?.icon ?? "shapes");
            return (
              <div
                key={card.id}
                id={`${listId}-${card.id}`}
                role="option"
                tabIndex={-1}
                aria-selected={index === active}
                onMouseEnter={() => setActive(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick(card)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") pick(card);
                }}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                  index === active && "bg-accent",
                )}
              >
                <Icon
                  aria-hidden
                  className="size-4 shrink-0"
                  style={{ color: typeColor(type?.color ?? "slate") }}
                />
                <span className="truncate">{card.title}</span>
              </div>
            );
          })}
          {nameOption && (
            <div
              id={nameId}
              role="option"
              tabIndex={-1}
              aria-selected={active === results.length}
              onMouseEnter={() => setActive(results.length)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={pickName}
              onKeyDown={(event) => {
                if (event.key === "Enter") pickName();
              }}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                active === results.length && "bg-accent",
              )}
            >
              <TextCursorInput aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{t("cards.pickerUseName", { name })}</span>
            </div>
          )}
        </div>
        {cards.data && count === 0 && (
          <p className="px-2 py-3 text-center text-sm text-muted-foreground">
            {t("cards.pickerNone")}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
