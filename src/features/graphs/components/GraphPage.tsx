import { useNavigate, useParams } from "@tanstack/react-router";
import { Maximize } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { DocumentTitleField } from "@/components/DocumentTitleField";
import { Button } from "@/components/ui/button";
import { useCardTypes } from "@/features/card-types";
import { useMarkOpened } from "@/features/cards/hooks/useCards";
import type { Graph } from "@/lib/bindings";
import { documentRoute } from "@/lib/documentRoute";
import { useGraph, useGraphData, useRenameGraph } from "../hooks/useGraphs";
import { resolveSettings } from "../settings";
import { GraphCanvas, type GraphCanvasHandle } from "./GraphCanvas";
import { NodeList } from "./NodeList";

function TitleField({ graph }: { graph: Graph }) {
  const { t } = useTranslation();
  const rename = useRenameGraph(graph.id);
  return <DocumentTitleField title={graph.title} label={t("graphs.title")} rename={rename} />;
}

/** A graph, opened in the World tab: its name, the cards and their links (M5). */
export function GraphPage() {
  const { t } = useTranslation();
  const { worldId, graphId } = useParams({ from: "/world/$worldId/world/graph/$graphId" });
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const graph = useGraph(graphId);
  const data = useGraphData();
  const types = useCardTypes();
  const view = useRef<GraphCanvasHandle>(null);
  useMarkOpened(graphId);

  const typesById = useMemo(
    () => new Map((types.data ?? []).map((type) => [type.id, type])),
    [types.data],
  );

  const savedSettings = graph.data?.config.settings;
  const settings = useMemo(() => resolveSettings(savedSettings ?? {}), [savedSettings]);

  const error = graph.error ?? data.error;
  if (error) {
    return (
      <div className="p-6">
        <AppErrorMessage error={error} />
      </div>
    );
  }
  if (!graph.data || !data.data) return null;
  const { nodes, edges } = data.data;
  const open = (id: string) => void navigate(documentRoute(worldId, "card", id));

  return (
    <article
      aria-label={graph.data.title}
      className="glass flex h-full flex-col gap-3 rounded-lg p-3"
    >
      <header className="flex flex-wrap items-center gap-2">
        <TitleField graph={graph.data} />
        <Button variant="secondary" size="sm" onClick={() => view.current?.recenter()}>
          <Maximize />
          {t("graphs.recenter")}
        </Button>
      </header>
      <div className="flex min-h-0 flex-1 gap-3">
        {nodes.length === 0 ? (
          <p className="flex h-full flex-1 items-center justify-center rounded-lg bg-muted p-6 text-center text-sm text-muted-foreground">
            {t("graphs.empty")}
          </p>
        ) : (
          <>
            <div className="relative min-w-0 flex-1">
              <GraphCanvas
                ref={view}
                nodes={nodes}
                edges={edges}
                typesById={typesById}
                settings={settings}
                label={t("graphs.viewLabel", {
                  name: graph.data.title,
                  cards: nodes.length,
                  links: edges.length,
                })}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onOpen={open}
              />
            </div>
            <aside className="flex w-60 shrink-0 flex-col overflow-hidden">
              <NodeList
                nodes={nodes}
                edges={edges}
                typesById={typesById}
                selectedId={selectedId}
                onSelect={(id) => {
                  setSelectedId(id);
                  view.current?.centerOn(id);
                }}
                onOpen={open}
              />
            </aside>
          </>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{t("graphs.navigationHint")}</p>
    </article>
  );
}
