import { ChevronRight, Plus, Search, Shapes } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { CardType } from "@/lib/bindings";
import { cn } from "@/lib/utils";
import { typeColor } from "../colors";
import { useCardTypes, useCreateCardType } from "../hooks/useCardTypes";
import { typeIcon } from "../icons";
import { TypeDetail } from "./TypeDetail";

type CardTypesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function TypeRow({
  type,
  selected,
  depth,
  expanded,
  onToggle,
  onSelect,
}: {
  type: CardType;
  selected: boolean;
  depth: 0 | 1;
  /** `undefined`: no subtypes, no chevron. */
  expanded: boolean | undefined;
  onToggle: () => void;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const Icon = typeIcon(type.icon);
  return (
    <div
      className={cn(
        "flex items-center rounded-md",
        selected ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-accent",
      )}
    >
      <button
        type="button"
        aria-current={selected ? "true" : undefined}
        onClick={onSelect}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 rounded-md py-1.5 text-left text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          depth === 0 ? "pl-2" : "pl-7",
        )}
      >
        <Icon aria-hidden className="size-4 shrink-0" style={{ color: typeColor(type.color) }} />
        <span className="truncate">{type.name}</span>
      </button>
      {expanded !== undefined && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-expanded={expanded}
          aria-label={t("cardTypes.showSubtypes", { name: type.name })}
          onClick={onToggle}
        >
          <ChevronRight className={cn("transition-transform", expanded && "rotate-90")} />
        </Button>
      )}
    </div>
  );
}

/**
 * "Card types" screen (Home › Types): the list of types with a search, and
 * the selected type's details on the right.
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

  const query = search.trim().toLocaleLowerCase();
  const visible = useMemo(() => {
    const matches = (type: CardType) => type.name.toLocaleLowerCase().includes(query);
    return topLevel
      .map((type) => {
        const subs = all.filter((sub) => sub.parentId === type.id);
        if (query === "") return { type, subs, open: expanded.has(type.id) };
        const matchingSubs = subs.filter(matches);
        if (!matches(type) && matchingSubs.length === 0) return null;
        return { type, subs: matches(type) ? subs : matchingSubs, open: matchingSubs.length > 0 };
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
      <DialogContent className="glass flex h-[80vh] max-h-[48rem] flex-col gap-0 p-0 sm:max-w-4xl">
        <div className="border-b border-border px-5 py-3">
          <DialogTitle>{t("cardTypes.title")}</DialogTitle>
          <DialogDescription className="sr-only">{t("cardTypes.description")}</DialogDescription>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-[16rem_1fr]">
          <nav
            aria-label={t("cardTypes.listLabel")}
            className="flex min-h-0 flex-col gap-2 border-r border-border p-3"
          >
            <div className="flex items-center gap-1">
              <div className="relative flex-1">
                <Search
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  type="search"
                  aria-label={t("cardTypes.search")}
                  placeholder={t("cardTypes.search")}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="pl-8"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("cardTypes.newType")}
                title={t("cardTypes.newType")}
                onClick={createType}
                disabled={create.isPending}
              >
                <Plus />
              </Button>
            </div>
            <ul className="flex min-h-0 flex-col gap-0.5 overflow-y-auto">
              {visible.map(({ type, subs, open: isOpen }) => (
                <li key={type.id}>
                  <TypeRow
                    type={type}
                    depth={0}
                    selected={selected?.id === type.id}
                    expanded={subs.length > 0 ? isOpen : undefined}
                    onToggle={() => toggle(type.id)}
                    onSelect={() => setSelectedId(type.id)}
                  />
                  {isOpen && subs.length > 0 && (
                    <ul>
                      {subs.map((sub) => (
                        <li key={sub.id}>
                          <TypeRow
                            type={sub}
                            depth={1}
                            selected={selected?.id === sub.id}
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
          </nav>
          <div className="flex min-h-0 flex-col">
            {(types.error ?? create.error) && (
              <div className="p-5 pb-0">
                <AppErrorMessage error={types.error ?? create.error} />
              </div>
            )}
            {selected ? (
              <TypeDetail
                key={selected.id}
                type={selected}
                subtypes={subtypesOf(selected.id)}
                parent={parent}
                onSelect={setSelectedId}
              />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
                <Shapes aria-hidden className="size-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{t("cardTypes.empty")}</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
