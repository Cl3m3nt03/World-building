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
 * picks, Escape closes. `children` is the trigger.
 */
export function CardPicker({
  children,
  label,
  allowedTypeIds,
  excludeIds = [],
  onPick,
}: {
  children: ReactNode;
  /** Accessible name of the search field. */
  label: string;
  allowedTypeIds: string[];
  excludeIds?: string[];
  onPick: (cardId: string) => void;
}) {
  const { t } = useTranslation();
  const cards = useCardList(false);
  const types = useCardTypes();
  const [open, setOpen] = useState(false);
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

  const pick = (card: Card | undefined) => {
    if (!card) return;
    onPick(card.id);
    setOpen(false);
  };

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
      <PopoverContent align="start" className="glass flex w-80 flex-col gap-2 p-2">
        <Input
          type="search"
          role="combobox"
          aria-label={label}
          aria-expanded
          aria-controls={listId}
          aria-activedescendant={results[active] ? `${listId}-${results[active].id}` : undefined}
          placeholder={t("cards.pickerSearch")}
          value={search}
          autoFocus
          onChange={(event) => {
            setSearch(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((index) => Math.min(index + 1, results.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((index) => Math.max(index - 1, 0));
            } else if (event.key === "Enter") {
              event.preventDefault();
              pick(results[active]);
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
        </div>
        {cards.data && results.length === 0 && (
          <p className="px-2 py-3 text-center text-sm text-muted-foreground">
            {t("cards.pickerNone")}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
