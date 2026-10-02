import { Pin, PinOff } from "lucide-react";
import { type KeyboardEvent, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { typeColor, typeIcon } from "@/features/card-types";
import type { CardType, GraphEdge, GraphNode } from "@/lib/bindings";
import { cn } from "@/lib/utils";

type Props = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  typesById: ReadonlyMap<string, CardType>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  pinned: ReadonlyMap<string, unknown>;
  onTogglePin: (id: string) => void;
};

/**
 * The graph for the keyboard and screen readers (a canvas is neither): the
 * shown cards by name, as a list box. The arrows move the selection (the
 * drawing follows), Enter opens the card; under it, the selected card's
 * neighbours.
 */
export function NodeList({
  nodes,
  edges,
  typesById,
  selectedId,
  onSelect,
  onOpen,
  pinned,
  onTogglePin,
}: Props) {
  const { t } = useTranslation();
  const list = useRef<HTMLDivElement>(null);
  const sorted = useMemo(() => [...nodes].sort((a, b) => a.title.localeCompare(b.title)), [nodes]);
  const neighbours = useMemo(() => {
    if (!selectedId) return [];
    const ids = new Set<string>();
    for (const edge of edges) {
      if (edge.source === selectedId) ids.add(edge.target);
      if (edge.target === selectedId) ids.add(edge.source);
    }
    return sorted.filter((node) => ids.has(node.id));
  }, [edges, selectedId, sorted]);
  const selected = sorted.find((node) => node.id === selectedId) ?? null;
  const current = sorted.findIndex((node) => node.id === selectedId);

  // The selected option stays in view (a click on the drawing selects too).
  useEffect(() => {
    if (!selectedId) return;
    list.current
      ?.querySelector<HTMLElement>(`[data-id="${CSS.escape(selectedId)}"]`)
      ?.scrollIntoView?.({ block: "nearest" });
  }, [selectedId]);

  const onKeyDown = (event: KeyboardEvent) => {
    const moves: Record<string, number> = {
      // Nothing selected yet: the first (or last) card.
      ArrowDown: current < 0 ? 0 : current + 1,
      ArrowUp: current < 0 ? sorted.length - 1 : current - 1,
      Home: 0,
      End: sorted.length - 1,
    };
    const target = moves[event.key];
    if (target !== undefined) {
      event.preventDefault();
      const node = sorted[Math.min(sorted.length - 1, Math.max(0, target))];
      if (node) onSelect(node.id);
    } else if (event.key === "Enter" && selectedId) {
      event.preventDefault();
      onOpen(selectedId);
    }
  };

  const optionId = (id: string) => `graph-node-${id}`;

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <h2 id="graph-nodes-title" className="text-sm font-medium">
        {t("graphs.list.title", { count: sorted.length })}
      </h2>
      <div
        ref={list}
        role="listbox"
        tabIndex={0}
        aria-labelledby="graph-nodes-title"
        aria-activedescendant={selected ? optionId(selected.id) : undefined}
        onKeyDown={onKeyDown}
        className="min-h-0 flex-1 overflow-y-auto rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {sorted.map((node) => {
          const type = node.typeId ? typesById.get(node.typeId) : undefined;
          const Icon = typeIcon(type?.icon ?? "shapes");
          const isSelected = node.id === selectedId;
          return (
            // biome-ignore lint/a11y/useKeyWithClickEvents: the list box handles the keyboard
            <div
              key={node.id}
              id={optionId(node.id)}
              data-id={node.id}
              role="option"
              tabIndex={-1}
              aria-selected={isSelected}
              onClick={() => onSelect(node.id)}
              onDoubleClick={() => onOpen(node.id)}
              className={cn(
                "flex cursor-default items-center gap-2 rounded-sm px-2 py-1 text-sm",
                isSelected ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
              )}
            >
              <Icon
                aria-hidden
                className="size-4 shrink-0"
                style={{ color: typeColor(type?.color ?? "slate") }}
              />
              <span className="truncate">{node.title}</span>
              {pinned.has(node.id) && (
                <>
                  <Pin aria-hidden className="ml-auto size-3.5 shrink-0 text-primary" />
                  <span className="sr-only">{t("graphs.pins.pinnedMark")}</span>
                </>
              )}
            </div>
          );
        })}
      </div>
      {selected && (
        <Button
          variant="secondary"
          size="sm"
          aria-pressed={pinned.has(selected.id)}
          onClick={() => onTogglePin(selected.id)}
        >
          {pinned.has(selected.id) ? <PinOff /> : <Pin />}
          {pinned.has(selected.id)
            ? t("graphs.pins.unpinNamed", { name: selected.title })
            : t("graphs.pins.pinNamed", { name: selected.title })}
        </Button>
      )}
      {selected && (
        <section aria-label={t("graphs.list.neighbours", { name: selected.title })}>
          <h3 className="text-xs font-medium text-muted-foreground">
            {t("graphs.list.neighbours", { name: selected.title })}
          </h3>
          {neighbours.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("graphs.list.isolated")}</p>
          ) : (
            <ul className="flex flex-wrap gap-1 pt-1">
              {neighbours.map((node) => (
                <li key={node.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(node.id)}
                    className="rounded-sm bg-accent/50 px-1.5 py-0.5 text-xs hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
                  >
                    {node.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
