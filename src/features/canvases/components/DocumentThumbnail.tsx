import { FileQuestion, Map as MapIcon, Network, Share2 } from "lucide-react";
import { type ReactNode, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useCardTypes } from "@/features/card-types";
import { GraphCanvas } from "@/features/graphs/components/GraphCanvas";
import { visibleGraph } from "@/features/graphs/filters";
import { useGraph, useGraphData } from "@/features/graphs/hooks/useGraphs";
import { resolveSettings } from "@/features/graphs/settings";
import { useMap } from "@/features/maps";
import { AssetImage } from "@/features/media";
import { useTree } from "@/features/trees";
import type { TranslationKey } from "@/i18n";
import { cn } from "@/lib/utils";
import type { Embed, EmbedKind } from "../embeds";
import { useWorldDocuments } from "../hooks/useWorldDocuments";
import { SKETCH_NODE, treeSketch } from "../treeSketch";
import { CardThumbnail } from "./CardThumbnail";

const KIND_LABELS: Record<Exclude<EmbedKind, "card">, TranslationKey> = {
  map: "canvases.insert.kind.map",
  graph: "canvases.insert.kind.graph",
  tree: "canvases.insert.kind.tree",
};

const KIND_ICONS = { map: MapIcon, graph: Share2, tree: Network } as const;

const NO_PINS: ReadonlyMap<string, readonly [number, number]> = new Map();
const IGNORE = () => undefined;

/** A map's background image (a tiled map is too big for a thumbnail: its icon). */
function MapPreview({ id }: { id: string }) {
  const map = useMap(id);
  const assetId = map.data && !map.data.tiled ? map.data.backgroundAssetId : null;
  return assetId ? (
    <AssetImage assetId={assetId} alt="" className="size-full object-cover" />
  ) : (
    <MapIcon aria-hidden className="size-10 text-muted-foreground" />
  );
}

/** A graph as its page draws it (its filters and settings), fitted, read-only. */
function GraphPreview({ id }: { id: string }) {
  const graph = useGraph(id);
  const data = useGraphData();
  const types = useCardTypes();
  const config = graph.data?.config;
  const settings = useMemo(() => (config ? resolveSettings(config.settings) : null), [config]);
  const shown = useMemo(
    () =>
      data.data && config && settings
        ? visibleGraph(
            data.data,
            config.filters.typeIds ?? [],
            types.data ?? [],
            settings.hideIsolated,
          )
        : null,
    [data.data, config, settings, types.data],
  );
  const typesById = useMemo(
    () => new Map((types.data ?? []).map((type) => [type.id, type])),
    [types.data],
  );
  if (!shown || !settings || shown.nodes.length === 0) {
    return <Share2 aria-hidden className="size-10 text-muted-foreground" />;
  }
  return (
    <GraphCanvas
      nodes={shown.nodes}
      edges={shown.edges}
      typesById={typesById}
      settings={settings}
      label=""
      selectedId={null}
      onSelect={IGNORE}
      onOpen={IGNORE}
      pinned={NO_PINS}
      initialViewport={null}
      onViewChange={IGNORE}
    />
  );
}

/** A tree's first variant, sketched: its nodes and links. */
function TreePreview({ id }: { id: string }) {
  const tree = useTree(id);
  const content = tree.data?.variants[0]?.content;
  const sketch = useMemo(() => (content ? treeSketch(content) : null), [content]);
  if (!sketch || sketch.nodes.length === 0) {
    return <Network aria-hidden className="size-10 text-muted-foreground" />;
  }
  return (
    <svg aria-hidden viewBox={sketch.viewBox} className="size-full p-2">
      {sketch.lines.map((line, index) => (
        <line
          // biome-ignore lint/suspicious/noArrayIndexKey: lines have no id of their own
          key={index}
          {...line}
          stroke="var(--muted-foreground)"
          strokeWidth={6}
          strokeLinecap="round"
        />
      ))}
      {sketch.nodes.map((node) => (
        <rect
          key={node.id}
          x={node.x}
          y={node.y}
          width={SKETCH_NODE.width}
          height={SKETCH_NODE.height}
          rx={14}
          fill="var(--background)"
          stroke="var(--border)"
          strokeWidth={6}
        />
      ))}
    </svg>
  );
}

/** The frame of a map, graph or tree: its preview, its kind and its title. */
function DocumentFrame({
  kind,
  id,
  children,
}: {
  kind: Exclude<EmbedKind, "card">;
  id: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const documents = useWorldDocuments(kind);
  const document = documents.data?.find((each) => each.id === id);
  // Until the list is there, nothing is said to be missing.
  const missing = documents.isSuccess && !document;
  const Icon = missing ? FileQuestion : KIND_ICONS[kind];
  return (
    <div
      className={cn(
        "bz-canvas-card flex size-full flex-col overflow-hidden rounded-lg border bg-background text-foreground shadow-sm",
        missing ? "border-dashed text-muted-foreground" : "border-border",
      )}
    >
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-muted">
        {missing ? <Icon aria-hidden className="size-10" /> : children}
      </div>
      <div className="flex flex-col gap-0.5 px-2.5 py-2">
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase">
          <Icon aria-hidden className="size-3" />
          {t(KIND_LABELS[kind])}
        </span>
        <span className="truncate font-heading text-sm font-bold">
          {missing ? t("canvases.insert.missing") : (document?.title ?? "")}
        </span>
      </div>
    </div>
  );
}

/**
 * A world document on a canvas: a card's thumbnail, or a map, graph or tree
 * in preview. It only draws (inert): the pointer goes through to Excalidraw,
 * which moves and selects it; a double click opens the document.
 */
export function DocumentThumbnail({ embed }: { embed: Embed }) {
  return (
    <div inert className="size-full">
      {embed.kind === "card" ? (
        <CardThumbnail cardId={embed.id} />
      ) : (
        <DocumentFrame kind={embed.kind} id={embed.id}>
          {embed.kind === "map" ? (
            <MapPreview id={embed.id} />
          ) : embed.kind === "graph" ? (
            <GraphPreview id={embed.id} />
          ) : (
            <TreePreview id={embed.id} />
          )}
        </DocumentFrame>
      )}
    </div>
  );
}
