import { Filter } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { typeColor, typeIcon } from "@/features/card-types";
import type { CardType } from "@/lib/bindings";
import { cn } from "@/lib/utils";

/**
 * The graph's filters (docs/features/04-graph.md): card types and subtypes,
 * checked with the mouse or the keyboard; the menu stays open while
 * choosing. No type checked: every card.
 */
export function GraphFilters({
  types,
  typeIds,
  onChange,
}: {
  types: readonly CardType[];
  typeIds: readonly string[];
  onChange: (typeIds: string[]) => void;
}) {
  const { t } = useTranslation();
  const active = typeIds.length > 0;
  const keepOpen = (event: Event) => event.preventDefault();
  const label = active ? t("graphs.filters.buttonActive") : t("graphs.filters.button");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          title={label}
          className={cn("relative", active && "text-primary")}
        >
          <Filter />
          {active && (
            <span aria-hidden className="absolute top-1 right-1 size-1.5 rounded-full bg-primary" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="center" className="max-h-96 w-64 overflow-y-auto">
        <DropdownMenuLabel>{t("graphs.filters.types")}</DropdownMenuLabel>
        {types.map((type) => {
          const Icon = typeIcon(type.icon);
          return (
            <DropdownMenuCheckboxItem
              key={type.id}
              checked={typeIds.includes(type.id)}
              onSelect={keepOpen}
              onCheckedChange={(checked) =>
                onChange(checked ? [...typeIds, type.id] : typeIds.filter((id) => id !== type.id))
              }
              className={cn(type.parentId && "pl-12")}
            >
              <Icon aria-hidden style={{ color: typeColor(type.color) }} />
              {type.name}
            </DropdownMenuCheckboxItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!active} onSelect={() => onChange([])}>
          {t("graphs.filters.reset")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
