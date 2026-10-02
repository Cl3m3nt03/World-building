import { useNavigate, useParams } from "@tanstack/react-router";
import { Maximize } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { DocumentTitleField } from "@/components/DocumentTitleField";
import { Button } from "@/components/ui/button";
import { useCardTypes } from "@/features/card-types";
import { useMarkOpened } from "@/features/cards/hooks/useCards";
import type { CardType, Graph, GraphConfig, GraphData } from "@/lib/bindings";
import { documentRoute } from "@/lib/documentRoute";
import { visibleGraph } from "../filters";
import { useGraph, useGraphData, useRenameGraph } from "../hooks/useGraphs";
import { searchNodes } from "../search";
import { resolveSettings } from "../settings";
import { GraphCanvas, type GraphCanvasHandle } from "./GraphCanvas";
import { GraphFilters } from "./GraphFilters";
import { GraphSearch } from "./GraphSearch";
import { NodeList } from "./NodeList";

function TitleField({ graph }: { graph: Graph }) {
  const { t } = useTranslation();
  const rename = useRenameGraph(graph.id);
  return <DocumentTitleField title={graph.title} label={t("graphs.title")} rename={rename} />;
}

/** A graph, opened in the World tab: its name, the cards and their links (M5). */
export function GraphPage() {
  const { graphId } = useParams({ from: "/world/$worldId/world/graph/$graphId" });
  const graph = useGraph(graphId);
  const data = useGraphData();
  const types = useCardTypes();
  useMarkOpened(graphId);

  const error = graph.error ?? data.error ?? types.error;
  if (error) {
    return (
      <div className="p-6">
        <AppErrorMessage error={error} />
      </div>
    );
  }
  if (!graph.data || !data.data || !types.data) return null;
  // Remounted for another graph: the editor starts from that graph's configuration.
  return <GraphEditor key={graph.data.id} graph={graph.data} data={data.data} types={types.data} />;
}

function GraphEditor({ graph, data, types }: { graph: Graph; data: GraphData; types: CardType[] }) {
  const { t } = useTranslation();
  const { worldId } = useParams({ from: "/world/$worldId/world/graph/$graphId" });
  const navigate = useNavigate();
  const view = useRef<GraphCanvasHandle>(null);
  const [config, setConfig] = useState<GraphConfig>(graph.config);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");

  const typesById = useMemo(() => new Map(types.map((type) => [type.id, type])), [types]);
  const settings = useMemo(() => resolveSettings(config.settings), [config.settings]);
  const typeIds = useMemo(() => config.filters.typeIds ?? [], [config.filters.typeIds]);
  const shown = useMemo(
    () => visibleGraph(data, typeIds, types, settings.hideIsolated),
    [data, typeIds, types, settings.hideIsolated],
  );
  const { nodes, edges } = shown;
  const found = useMemo(() => searchNodes(nodes, query), [nodes, query]);
  const highlighted = useMemo(
    () => (query.trim() === "" ? null : new Set(found.map((node) => node.id))),
    [found, query],
  );
  // A card hidden by the filters is no longer selected.
  const selected = selectedId && nodes.some((node) => node.id === selectedId) ? selectedId : null;
  const open = (id: string) => void navigate(documentRoute(worldId, "card", id));

  return (
    <article aria-label={graph.title} className="glass flex h-full flex-col gap-3 rounded-lg p-3">
      <header className="flex flex-wrap items-center gap-2">
        <TitleField graph={graph} />
        <Button variant="secondary" size="sm" onClick={() => view.current?.recenter()}>
          <Maximize />
          {t("graphs.recenter")}
        </Button>
      </header>
      {data.nodes.length === 0 ? (
        <p className="flex min-h-0 flex-1 items-center justify-center rounded-lg bg-muted p-6 text-center text-sm text-muted-foreground">
          {t("graphs.empty")}
        </p>
      ) : (
        <div className="flex min-h-0 flex-1 gap-3">
          <div className="relative min-w-0 flex-1">
            {nodes.length === 0 ? (
              <p className="flex h-full items-center justify-center rounded-lg bg-muted p-6 text-center text-sm text-muted-foreground">
                {t("graphs.filters.none")}
              </p>
            ) : (
              <GraphCanvas
                ref={view}
                nodes={nodes}
                edges={edges}
                typesById={typesById}
                settings={settings}
                label={t("graphs.viewLabel", {
                  name: graph.title,
                  cards: nodes.length,
                  links: edges.length,
                })}
                selectedId={selected}
                highlighted={highlighted}
                onSelect={setSelectedId}
                onOpen={open}
              />
            )}
            <div
              role="toolbar"
              aria-label={t("graphs.toolbar")}
              className="glass absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-lg p-1"
            >
              <GraphSearch
                open={searching}
                onOpenChange={setSearching}
                query={query}
                onQueryChange={(next) => {
                  setQuery(next);
                  // A search shows its results: a selection would hide them.
                  if (next.trim() !== "") setSelectedId(null);
                }}
                count={found.length}
                onSubmit={() => {
                  const first = found[0];
                  if (first) view.current?.centerOn(first.id);
                }}
              />
              <GraphFilters
                types={types}
                typeIds={typeIds}
                onChange={(next) =>
                  setConfig((current) => ({ ...current, filters: { typeIds: next } }))
                }
              />
            </div>
          </div>
          <aside className="flex w-60 shrink-0 flex-col overflow-hidden">
            <NodeList
              nodes={nodes}
              edges={edges}
              typesById={typesById}
              selectedId={selected}
              onSelect={(id) => {
                setSelectedId(id);
                view.current?.centerOn(id);
              }}
              onOpen={open}
            />
          </aside>
        </div>
      )}
      <p className="text-xs text-muted-foreground">{t("graphs.navigationHint")}</p>
    </article>
  );
}
