import { ExternalLink, Pin, PinOff } from "lucide-react";
import { type KeyboardEvent, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { typeColor, typeIcon } from "@/features/card-types";
import { relationName } from "@/features/trees/relations";
import type { CardType, EdgeReason, GraphEdge, GraphNode, RelationType } from "@/lib/bindings";
import { cn } from "@/lib/utils";
import { describeReason, relationNamer } from "../reasons";

type Props = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  typesById: ReadonlyMap<string, CardType>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  pinned: ReadonlyMap<string, unknown>;
  onTogglePin: (id: string) => void;
  /** The world's relation types, to name the relations of the links. */
  relationTypes?: readonly RelationType[];
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
  relationTypes = [],
}: Props) {
  const { t } = useTranslation();
  const list = useRef<HTMLDivElement>(null);
  const sorted = useMemo(() => [...nodes].sort((a, b) => a.title.localeCompare(b.title)), [nodes]);
  // The selected card's neighbours, each with why they are linked.
  const neighbours = useMemo(() => {
    if (!selectedId) return [];
    const reasons = new Map<string, EdgeReason[]>();
    for (const edge of edges) {
      if (edge.source === selectedId) reasons.set(edge.target, edge.reasons);
      if (edge.target === selectedId) reasons.set(edge.source, edge.reasons);
    }
    return sorted
      .filter((node) => reasons.has(node.id))
      .map((node) => ({ node, reasons: reasons.get(node.id) ?? [] }));
  }, [edges, selectedId, sorted]);
  const titles = useMemo(() => new Map(nodes.map((node) => [node.id, node.title])), [nodes]);
  const nameRelation = useMemo(
    () => relationNamer(relationTypes, (type) => relationName(type, t)),
    [relationTypes, t],
  );
  const say = (reason: EdgeReason, neighbour: string) =>
    describeReason(
      reason,
      [selectedId ?? "", neighbour],
      (id) => titles.get(id) ?? "?",
      nameRelation,
      t,
    );
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
            <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto pt-1">
              {neighbours.map(({ node, reasons }) => (
                <li
                  key={node.id}
                  className="flex flex-col gap-0.5 rounded-sm bg-accent/30 px-1.5 py-1"
                >
                  <span className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onSelect(node.id)}
                      className="truncate rounded-sm text-left text-xs font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      {node.title}
                    </button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="ml-auto"
                      aria-label={t("graphs.list.open", { name: node.title })}
                      title={t("graphs.list.open", { name: node.title })}
                      onClick={() => onOpen(node.id)}
                    >
                      <ExternalLink />
                    </Button>
                  </span>
                  <ul className="flex flex-col text-[11px] leading-snug text-muted-foreground">
                    {reasons.map((reason) => {
                      const text = say(reason, node.id);
                      return <li key={text}>{text}</li>;
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
