import { Search, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: string;
  onQueryChange: (query: string) => void;
  /** How many cards match (announced). */
  count: number;
  /** Enter: the view goes to the first result. */
  onSubmit: () => void;
};

/**
 * The magnifying glass of the graph's bar (docs/features/04-graph.md): a
 * field whose matching cards stand out, the rest fading. Enter goes to the
 * first one, Escape closes the field.
 */
export function GraphSearch({ open, onOpenChange, query, onQueryChange, count, onSubmit }: Props) {
  const { t } = useTranslation();
  const button = useRef<HTMLButtonElement>(null);
  // Closed from the field: the focus goes back to the magnifying glass,
  // once it is shown again.
  const refocus = useRef(false);
  const close = () => {
    refocus.current = true;
    onQueryChange("");
    onOpenChange(false);
  };
  useEffect(() => {
    if (open || !refocus.current) return;
    refocus.current = false;
    button.current?.focus();
  }, [open]);

  if (!open) {
    return (
      <Button
        ref={button}
        variant="ghost"
        size="icon-sm"
        aria-label={t("graphs.search.open")}
        title={t("graphs.search.open")}
        onClick={() => onOpenChange(true)}
      >
        <Search />
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <Search aria-hidden className="size-4 text-muted-foreground" />
      <Input
        autoFocus
        type="search"
        value={query}
        aria-label={t("graphs.search.label")}
        placeholder={t("graphs.search.placeholder")}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onSubmit();
          } else if (event.key === "Escape") {
            event.preventDefault();
            close();
          }
        }}
        className="h-7 w-48"
      />
      <span aria-live="polite" className="min-w-16 text-xs text-muted-foreground">
        {query.trim() === "" ? "" : t("graphs.search.count", { count })}
      </span>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={t("graphs.search.close")}
        title={t("graphs.search.close")}
        onClick={close}
      >
        <X />
      </Button>
    </div>
  );
}
