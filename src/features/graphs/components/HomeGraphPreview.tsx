import { useNavigate } from "@tanstack/react-router";
import { Share2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { useCardTypes } from "@/features/card-types";
import { documentRoute } from "@/lib/documentRoute";
import { visibleGraph } from "../filters";
import { useGraphData } from "../hooks/useGraphs";
import { searchNodes } from "../search";
import { DEFAULT_SETTINGS } from "../settings";
import { GraphCanvas, type GraphCanvasHandle } from "./GraphCanvas";
import { GraphFilters } from "./GraphFilters";
import { GraphSearch } from "./GraphSearch";

const NO_PINS: ReadonlyMap<string, readonly [number, number]> = new Map();
/** Home keeps no framing: the preview always shows the whole graph first. */
const IGNORE_VIEW = () => undefined;

/**
 * The world's graph on Home (docs/features/00-interface.md): every card and
 * its links, with the search and the filters of a graph; nothing is saved.
 * A click selects a card and shows its neighbours, a double click opens it.
 * Until cards are linked, it says how to link them.
 */
export function HomeGraphPreview({ worldId }: { worldId: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const data = useGraphData();
  const types = useCardTypes();
  const view = useRef<GraphCanvasHandle>(null);
  const [typeIds, setTypeIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");

  const typesById = useMemo(
    () => new Map((types.data ?? []).map((type) => [type.id, type])),
    [types.data],
  );
  const shown = useMemo(
    () => (data.data ? visibleGraph(data.data, typeIds, types.data ?? [], false) : null),
    [data.data, typeIds, types.data],
  );
  const found = useMemo(() => searchNodes(shown?.nodes ?? [], query), [shown, query]);
  const highlighted = useMemo(
    () => (query.trim() === "" ? null : new Set(found.map((node) => node.id))),
    [found, query],
  );

  const error = data.error ?? types.error;
  if (error) return <AppErrorMessage error={error} />;
  if (!data.data || !types.data || !shown) return null;
  if (data.data.edges.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        <Share2 aria-hidden className="size-5 shrink-0" />
        {t("home.graphNoLinks")}
      </p>
    );
  }
  const open = (id: string) => void navigate(documentRoute(worldId, "card", id));

  return (
    <div className="relative h-80">
      {shown.nodes.length === 0 ? (
        <p className="flex h-full items-center justify-center rounded-lg bg-muted p-6 text-center text-sm text-muted-foreground">
          {t("graphs.filters.none")}
        </p>
      ) : (
        <GraphCanvas
          ref={view}
          nodes={shown.nodes}
          edges={shown.edges}
          typesById={typesById}
          settings={DEFAULT_SETTINGS}
          label={t("home.graphLabel", { cards: shown.nodes.length, links: shown.edges.length })}
          selectedId={
            selectedId && shown.nodes.some((node) => node.id === selectedId) ? selectedId : null
          }
          highlighted={highlighted}
          onSelect={setSelectedId}
          onOpen={open}
          pinned={NO_PINS}
          initialViewport={null}
          onViewChange={IGNORE_VIEW}
        />
      )}
      <div
        role="toolbar"
        aria-label={t("graphs.toolbar")}
        className="glass absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-lg p-1"
      >
        <GraphSearch
          open={searching}
          onOpenChange={setSearching}
          query={query}
          onQueryChange={(next) => {
            setQuery(next);
            if (next.trim() !== "") setSelectedId(null);
          }}
          count={found.length}
          onSubmit={() => {
            const first = found[0];
            if (first) view.current?.centerOn(first.id);
          }}
        />
        <GraphFilters types={types.data} typeIds={typeIds} onChange={setTypeIds} />
      </div>
    </div>
  );
}
