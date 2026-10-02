import { SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { typeColor, typeIcon, useCardTypes } from "@/features/card-types";
import type { TranslationKey } from "@/i18n";
import type { DocumentKind, SortBy } from "@/lib/bindings";
import { cn } from "@/lib/utils";
import { DEFAULT_VIEW, isFiltered, type TreeView } from "../tree";

/** Kinds of document, and the milestone bringing those not made yet. */
const KINDS: { kind: DocumentKind; label: TranslationKey; milestone?: string }[] = [
  { kind: "card", label: "sidebar.view.kind.card" },
  { kind: "map", label: "sidebar.view.kind.map" },
  { kind: "graph", label: "sidebar.view.kind.graph" },
  { kind: "tree", label: "sidebar.view.kind.tree", milestone: "M6" },
  { kind: "canvas", label: "sidebar.view.kind.canvas", milestone: "M7" },
];

const SORTS: { sort: SortBy; label: TranslationKey }[] = [
  { sort: "manual", label: "sidebar.view.sort.manual" },
  { sort: "name", label: "sidebar.view.sort.name" },
  { sort: "created", label: "sidebar.view.sort.created" },
];

type Props = {
  view: TreeView;
  /**
   * What changes, or how from the latest view: merged with the view as
   * saved, so quick choices in a row all count.
   */
  onChange: (change: Partial<TreeView> | ((latest: TreeView) => Partial<TreeView>)) => void;
};

/**
 * Filters (kinds of document, card types) and sort of the sidebar, next to
 * its search field. The menu stays open while choices are made.
 */
export function ViewMenu({ view, onChange }: Props) {
  const { t } = useTranslation();
  const types = useCardTypes();
  const changed = isFiltered(view) || view.sort !== "manual";
  const toggle = <T,>(list: T[], value: T) =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
  const keepOpen = (event: Event) => event.preventDefault();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={changed ? t("sidebar.view.buttonActive") : t("sidebar.view.button")}
          title={changed ? t("sidebar.view.buttonActive") : t("sidebar.view.button")}
          className={cn("relative shrink-0", changed && "text-primary")}
        >
          <SlidersHorizontal />
          {changed && (
            <span aria-hidden className="absolute top-1 right-1 size-1.5 rounded-full bg-primary" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>{t("sidebar.view.kinds")}</DropdownMenuLabel>
        {KINDS.map(({ kind, label, milestone }) => (
          <DropdownMenuCheckboxItem
            key={kind}
            checked={view.kinds.includes(kind)}
            disabled={milestone !== undefined}
            onSelect={keepOpen}
            onCheckedChange={() => onChange((latest) => ({ kinds: toggle(latest.kinds, kind) }))}
          >
            {t(label)}
            {milestone && (
              <DropdownMenuShortcut>
                {t("sidebar.document.soon", { milestone })}
              </DropdownMenuShortcut>
            )}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t("sidebar.view.types")}</DropdownMenuLabel>
        {(types.data ?? []).map((type) => {
          const Icon = typeIcon(type.icon);
          return (
            <DropdownMenuCheckboxItem
              key={type.id}
              checked={view.typeIds.includes(type.id)}
              onSelect={keepOpen}
              onCheckedChange={() =>
                onChange((latest) => ({ typeIds: toggle(latest.typeIds, type.id) }))
              }
              className={cn(type.parentId && "pl-12")}
            >
              <Icon aria-hidden style={{ color: typeColor(type.color) }} />
              {type.name}
            </DropdownMenuCheckboxItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t("sidebar.view.sortBy")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={view.sort}
          onValueChange={(sort) => {
            const chosen = SORTS.find((candidate) => candidate.sort === sort);
            if (chosen) onChange({ sort: chosen.sort });
          }}
        >
          {SORTS.map(({ sort, label }) => (
            <DropdownMenuRadioItem key={sort} value={sort} onSelect={keepOpen}>
              {t(label)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuCheckboxItem
          checked={view.reversed}
          disabled={view.sort === "manual"}
          onSelect={keepOpen}
          onCheckedChange={(reversed) => onChange({ reversed: reversed === true })}
        >
          {view.sort === "created" ? t("sidebar.view.newestFirst") : t("sidebar.view.reversed")}
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!changed} onSelect={() => onChange(DEFAULT_VIEW)}>
          {t("sidebar.view.reset")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
