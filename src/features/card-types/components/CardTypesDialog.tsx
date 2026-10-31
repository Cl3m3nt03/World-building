import { ChevronRight, Plus, Search, Shapes } from "lucide-react";
import { type KeyboardEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { isMovingProperty } from "@/features/properties";
import type { CardType } from "@/lib/bindings";
import { fold } from "@/lib/text";
import { cn } from "@/lib/utils";
import { useCardTypes, useCreateCardType } from "../hooks/useCardTypes";
import { TypeBadge } from "./TypeBadge";
import { TypeDetail } from "./TypeDetail";

type CardTypesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function TypeRow({
  type,
  selected,
  depth,
  subtypeCount,
  expanded,
  onToggle,
  onSelect,
}: {
  type: CardType;
  selected: boolean;
  depth: 0 | 1;
  subtypeCount: number;
  /** `undefined`: no subtypes, no chevron. */
  expanded: boolean | undefined;
  onToggle: () => void;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        "relative flex items-center rounded-md transition-colors duration-(--bz-duration-fast) ease-atlas",
        selected ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/70",
      )}
    >
      {selected && (
        // The engraved gold mark of the selected type.
        <span aria-hidden className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary" />
      )}
      <button
        type="button"
        data-type-row
        aria-current={selected ? "true" : undefined}
        onClick={onSelect}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2.5 rounded-md py-1.5 pr-1 text-left text-sm outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
          depth === 0 ? "pl-2.5" : "pl-8",
        )}
      >
        <TypeBadge type={type} size={depth === 0 ? "md" : "sm"} />
        <span className="truncate">{type.name}</span>
      </button>
      {expanded !== undefined && (
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={expanded}
          aria-label={t("cardTypes.showSubtypes", { name: type.name })}
          onClick={onToggle}
          className="h-7 gap-0.5 px-1.5 text-xs text-muted-foreground tabular-nums"
        >
          {subtypeCount}
          <ChevronRight
            className={cn(
              "transition-transform duration-(--bz-duration-fast) ease-atlas",
              expanded && "rotate-90",
            )}
          />
        </Button>
      )}
    </div>
  );
}

/** ↑ ↓ (and Home, End) move between the rows of the list. */
function moveBetweenRows(event: KeyboardEvent<HTMLElement>) {
  const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
  if (!keys.includes(event.key)) return;
  const rows = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>("button[data-type-row]"),
  );
  if (rows.length === 0) return;
  const index = rows.indexOf(document.activeElement as HTMLButtonElement);
  let next = index;
  if (event.key === "ArrowDown") next = Math.min(index + 1, rows.length - 1);
  else if (event.key === "ArrowUp") next = Math.max(index - 1, 0);
  else if (event.key === "Home") next = 0;
  else next = rows.length - 1;
  event.preventDefault();
  rows[next]?.focus();
}

/**
 * "Card types" screen (Home › Types), V2-3.6: the list of types on the left
 * (a search, the subtypes folded under their type, « New type » at the
 * bottom), the selected type's sheet on the right.
 */
export function CardTypesDialog({ open, onOpenChange }: CardTypesDialogProps) {
  const { t } = useTranslation();
  const types = useCardTypes();
  const create = useCreateCardType();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const all = types.data ?? [];

  const topLevel = all.filter((type) => type.parentId === null);
  const subtypesOf = (id: string) => all.filter((type) => type.parentId === id);
  const selected = all.find((type) => type.id === selectedId) ?? topLevel[0];
  const parent = selected?.parentId ? all.find((type) => type.id === selected.parentId) : undefined;

  // The selected subtype's type stays open.
  useEffect(() => {
    if (parent) setExpanded((current) => new Set(current).add(parent.id));
  }, [parent]);

  useEffect(() => {
    if (open) setSearch("");
  }, [open]);

  // Without accents nor case: « eve » finds « Événement ».
  const query = fold(search.trim());
  const visible = useMemo(() => {
    const matches = (type: CardType) => fold(type.name).includes(query);
    return topLevel
      .map((type) => {
        const subs = all.filter((sub) => sub.parentId === type.id);
        if (query === "") return { type, subs, count: subs.length, open: expanded.has(type.id) };
        const matchingSubs = subs.filter(matches);
        if (!matches(type) && matchingSubs.length === 0) return null;
        return {
          type,
          subs: matches(type) ? subs : matchingSubs,
          count: subs.length,
          open: matchingSubs.length > 0,
        };
      })
      .filter((row) => row !== null);
  }, [all, topLevel, query, expanded]);

  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const createType = () =>
    create.mutate(
      { parentId: null, name: t("cardTypes.newTypeName"), icon: "shapes", color: "slate" },
      { onSuccess: (type) => setSelectedId(type.id) },
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[min(48rem,calc(100vh-3rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(64rem,calc(100%-2rem))]"
        onEscapeKeyDown={(event) => {
          if (isMovingProperty(event.target)) event.preventDefault();
        }}
      >
        <div className="grid min-h-0 flex-1 grid-cols-[15.5rem_1fr]">
          <nav
            aria-label={t("cardTypes.listLabel")}
            className="flex min-h-0 flex-col border-r border-border bg-(--bz-hover)"
          >
            <div className="flex flex-col gap-0.5 px-4 pt-4 pb-3">
              <DialogTitle className="text-xl">{t("cardTypes.title")}</DialogTitle>
              <DialogDescription className="sr-only">
                {t("cardTypes.description")}
              </DialogDescription>
              {types.data && (
                <p className="text-xs text-muted-foreground">
                  {t("cardTypes.count", { count: topLevel.length })}
                </p>
              )}
            </div>
            <div className="px-3 pb-2">
              <div className="relative">
                <Search
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  type="search"
                  aria-label={t("cardTypes.search")}
                  placeholder={t("cardTypes.search")}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-8 w-full rounded-md border border-input bg-(--bz-field) pr-2 pl-8 text-sm shadow-(--bz-field-inset) outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/30"
                />
              </div>
            </div>
            <ul
              onKeyDown={moveBetweenRows}
              className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2"
            >
              {visible.map(({ type, subs, count, open: isOpen }) => (
                <li key={type.id}>
                  <TypeRow
                    type={type}
                    depth={0}
                    selected={selected?.id === type.id}
                    subtypeCount={count}
                    expanded={subs.length > 0 ? isOpen : undefined}
                    onToggle={() => toggle(type.id)}
                    onSelect={() => setSelectedId(type.id)}
                  />
                  {isOpen && subs.length > 0 && (
                    <ul className="mt-0.5 flex flex-col gap-0.5">
                      {subs.map((sub) => (
                        <li key={sub.id}>
                          <TypeRow
                            type={sub}
                            depth={1}
                            selected={selected?.id === sub.id}
                            subtypeCount={0}
                            expanded={undefined}
                            onToggle={() => {}}
                            onSelect={() => setSelectedId(sub.id)}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
              {types.data && visible.length === 0 && (
                <li className="px-2 py-4 text-center text-sm text-muted-foreground">
                  {query ? t("cardTypes.noMatch") : t("cardTypes.empty")}
                </li>
              )}
            </ul>
            <div className="border-t border-border p-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={createType}
                disabled={create.isPending}
                className="w-full justify-start"
              >
                <Plus />
                {t("cardTypes.newType")}
              </Button>
            </div>
          </nav>
          <div className="flex min-h-0 min-w-0 flex-col">
            {(types.error ?? create.error) && (
              <div className="px-8 pt-6">
                <AppErrorMessage error={types.error ?? create.error} />
              </div>
            )}
            {selected ? (
              <TypeDetail
                key={selected.id}
                type={selected}
                subtypes={subtypesOf(selected.id)}
                parent={parent}
                allTypes={all}
                onSelect={setSelectedId}
              />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
                <Shapes aria-hidden className="size-10 text-muted-foreground" strokeWidth={1.25} />
                <p className="text-sm text-muted-foreground">{t("cardTypes.empty")}</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
