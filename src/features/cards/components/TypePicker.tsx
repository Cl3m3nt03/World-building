import { CornerDownLeft, Plus, Search } from "lucide-react";
import { type KeyboardEvent, useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useUiStore } from "@/app/stores/ui";
import { typeColor, typeIcon } from "@/features/card-types";
import type { CardType } from "@/lib/bindings";
import { cn } from "@/lib/utils";

/** Search without case nor accents: « eve » finds « Événement ». */
function folded(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase();
}

/**
 * The type picker (V2-3.1, after vvd's « Sélectionner un type »): a search
 * field over the types, their subtypes indented under them, arrows to move,
 * Enter to pick, and « New type » at the bottom. The search field keeps the
 * focus; the list follows it (combobox pattern).
 */
export function TypePicker({
  types,
  current,
  onPick,
  onNewType,
  title,
}: {
  types: CardType[];
  /** The type already chosen (a card's type), marked in the list. */
  current?: string | null;
  onPick: (type: CardType) => void;
  /** Called before the types screen opens (to close the picker). */
  onNewType?: () => void;
  title: string;
}) {
  const { t } = useTranslation();
  const openTypes = useUiStore((state) => state.setCardTypesOpen);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const titleId = useId();
  const needle = folded(query.trim());
  // A subtype that matches brings its type along, so it is never shown alone.
  const shown = useMemo(() => {
    if (!needle) return types;
    const matches = (type: CardType) => folded(type.name).includes(needle);
    return types.filter(
      (type) =>
        matches(type) ||
        (type.parentId === null && types.some((sub) => sub.parentId === type.id && matches(sub))),
    );
  }, [types, needle]);
  const index = Math.min(active, Math.max(shown.length - 1, 0));
  const optionId = (i: number) => `${listId}-${i}`;

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") setActive(Math.min(index + 1, shown.length - 1));
    else if (event.key === "ArrowUp") setActive(Math.max(index - 1, 0));
    else if (event.key === "Home") setActive(0);
    else if (event.key === "End") setActive(shown.length - 1);
    else if (event.key === "Enter") {
      const type = shown[index];
      if (type) onPick(type);
    } else return;
    event.preventDefault();
  };

  return (
    <div className="flex w-80 flex-col">
      <p id={titleId} className="rubric px-3 pt-3 pb-1.5">
        {title}
      </p>
      <div className="relative px-2">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-4.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-activedescendant={shown.length > 0 ? optionId(index) : undefined}
          aria-label={t("typePicker.search")}
          // biome-ignore lint/a11y/noAutofocus: the picker opens to be typed into
          autoFocus
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          placeholder={t("typePicker.search")}
          className="h-8 w-full rounded-md border border-input bg-(--bz-field) pr-2 pl-8 text-sm shadow-(--bz-field-inset) outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/30"
        />
      </div>
      <div
        id={listId}
        role="listbox"
        aria-labelledby={titleId}
        className="flex max-h-72 flex-col overflow-y-auto p-1.5"
      >
        {shown.map((type, i) => {
          const Icon = typeIcon(type.icon);
          const isCurrent = type.id === current;
          return (
            // biome-ignore lint/a11y/useKeyWithClickEvents: the keyboard goes through the search field (aria-activedescendant)
            <div
              key={type.id}
              id={optionId(i)}
              role="option"
              tabIndex={-1}
              aria-selected={i === index}
              onMouseEnter={() => setActive(i)}
              onClick={() => onPick(type)}
              className={cn(
                "flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                type.parentId && "pl-8",
                i === index && "bg-muted",
              )}
            >
              <Icon aria-hidden className="size-4" style={{ color: typeColor(type.color) }} />
              <span className="flex-1 truncate">{type.name}</span>
              {isCurrent && (
                <span className="text-xs text-muted-foreground">{t("typePicker.current")}</span>
              )}
            </div>
          );
        })}
        {shown.length === 0 && (
          <p className="px-2 py-3 text-center text-sm text-muted-foreground">
            {types.length === 0 ? t("cards.noTypes") : t("typePicker.none", { query })}
          </p>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border p-1.5">
        <button
          type="button"
          onClick={() => {
            onNewType?.();
            openTypes(true);
          }}
          className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Plus aria-hidden className="size-4" />
          {t("cardTypes.newType")}
        </button>
        <span
          aria-hidden
          className="flex items-center gap-2 pr-1 text-[0.6875rem] text-muted-foreground"
        >
          <span>{t("typePicker.move")}</span>
          <span className="flex items-center gap-0.5">
            <CornerDownLeft className="size-3" />
            {t("typePicker.pick")}
          </span>
        </span>
      </div>
    </div>
  );
}
