import {
  BaseEdge,
  type Edge,
  EdgeLabelRenderer,
  type EdgeProps,
  EdgeToolbar,
  getSmoothStepPath,
  useStore,
} from "@xyflow/react";
import { ArrowLeftRight, GitFork, Link2, Trash2 } from "lucide-react";
import { memo, type SyntheticEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { LineStyle } from "@/lib/bindings";
import { relationIcon, relationName } from "../relations";
import { RelationMenu } from "./RelationMenu";
import { useTreeActions } from "./treeActions";

export type RelationEdgeData = {
  lineStyle: LineStyle;
  relationTypeId: string | null;
  /** A link from a link: it cannot be turned round. */
  junction: boolean;
  /** What the link says, in its direction (« Gilraen: parent of Aragorn »). */
  tooltip: string;
  /** Hovered: the tooltip shows. */
  hovered: boolean;
};

export type RelationEdgeType = Edge<RelationEdgeData, "relation">;

const DASHES: Record<LineStyle, string | undefined> = {
  solid: undefined,
  dashed: "8 6",
  dotted: "1 6",
};

const LINE_STYLES: {
  value: LineStyle;
  label: "trees.edges.solid" | "trees.edges.dashed" | "trees.edges.dotted";
}[] = [
  { value: "solid", label: "trees.edges.solid" },
  { value: "dashed", label: "trees.edges.dashed" },
  { value: "dotted", label: "trees.edges.dotted" },
];

/** Size of the link's bar on screen (px), and its gap to the link. */
const BAR = { width: 240, height: 40, gap: 10, margin: 14 };

type Point = { x: number; y: number };

/**
 * Where a selected link's bar goes: above its middle, else below, else on
 * its right — the first place that does not cover an end of the link (the
 * ends are dragged to reconnect it). In tree units; the bar keeps its size
 * on screen, so it covers more of the tree when zoomed out.
 */
export function barPlace(middle: Point, ends: Point[], zoom: number) {
  const w = BAR.width / zoom;
  const h = BAR.height / zoom;
  const gap = BAR.gap / zoom;
  const margin = BAR.margin / zoom;
  const covers = (left: number, top: number) =>
    ends.some(
      (end) =>
        end.x > left - margin &&
        end.x < left + w + margin &&
        end.y > top - margin &&
        end.y < top + h + margin,
    );
  const places = [
    {
      x: middle.x,
      y: middle.y - gap,
      alignX: "center",
      alignY: "bottom",
      left: middle.x - w / 2,
      top: middle.y - gap - h,
    },
    {
      x: middle.x,
      y: middle.y + gap,
      alignX: "center",
      alignY: "top",
      left: middle.x - w / 2,
      top: middle.y + gap,
    },
    {
      x: middle.x + gap,
      y: middle.y,
      alignX: "left",
      alignY: "center",
      left: middle.x + gap,
      top: middle.y - h / 2,
    },
  ] as const;
  const place = places.find((p) => !covers(p.left, p.top)) ?? places[0];
  return { x: place.x, y: place.y, alignX: place.alignX, alignY: place.alignY };
}

/** A short line drawn in `style`, for the style menu. */
function LineSample({ style }: { style: LineStyle }) {
  return (
    <svg aria-hidden viewBox="0 0 24 4" className="h-1 w-6">
      <line
        x1="1"
        y1="2"
        x2="23"
        y2="2"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray={style === "dashed" ? "5 3" : style === "dotted" ? "0.5 3.5" : undefined}
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * A link of a relation tree: square corners, its line style, a tooltip on
 * hover. Selected, it has a bar (as on the board): its relation, turn it
 * round, its line style, remove it.
 */
export const RelationEdge = memo(function RelationEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<RelationEdgeType>) {
  const { t } = useTranslation();
  const actions = useTreeActions();
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 6,
  });
  const lineStyle = data?.lineStyle ?? "solid";
  const relation = data?.relationTypeId
    ? actions?.relationTypes.find((type) => type.id === data.relationTypeId)
    : undefined;
  const RelationIcon = relation ? relationIcon(relation.icon) : Link2;
  const zoom = useStore((state) => state.transform[2]);
  const bar = barPlace(
    { x: labelX, y: labelY },
    [
      { x: sourceX, y: sourceY },
      { x: targetX, y: targetY },
    ],
    zoom,
  );
  // The bar's events stay in it: React Flow would take its keys and clicks.
  const stop = (event: SyntheticEvent) => event.stopPropagation();
  const styleLabel = t(
    LINE_STYLES.find((s) => s.value === lineStyle)?.label ?? "trees.edges.solid",
  );

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        interactionWidth={18}
        style={{
          strokeWidth: 2,
          strokeDasharray: DASHES[lineStyle],
          strokeLinecap: lineStyle === "dotted" ? "round" : undefined,
        }}
      />
      {data?.hovered && !selected && (
        <EdgeLabelRenderer>
          <div
            role="tooltip"
            className="glass pointer-events-none absolute rounded-md border border-border px-2 py-1 text-xs whitespace-nowrap shadow-sm"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {data.tooltip}
          </div>
        </EdgeLabelRenderer>
      )}
      {selected && actions && data && (
        <EdgeToolbar
          edgeId={id}
          x={bar.x}
          y={bar.y}
          alignX={bar.alignX}
          alignY={bar.alignY}
          isVisible
        >
          <div
            role="toolbar"
            aria-label={t("trees.edges.toolbar", { link: data.tooltip })}
            className="nodrag nopan glass flex items-center gap-1 rounded-lg border border-border p-1 shadow-sm"
            onClick={stop}
            onKeyDown={stop}
            onDoubleClick={stop}
          >
            <RelationMenu
              relationTypes={actions.relationTypes}
              open={actions.relationMenuFor === id}
              onOpenChange={(open) => actions.setRelationMenuFor(open ? id : null)}
              onPick={(type) => {
                actions.setRelationMenuFor(null);
                actions.editEdge(id, { relationTypeId: type?.id ?? null });
              }}
            >
              <Button variant="ghost" size="sm">
                <RelationIcon />
                {relation ? relationName(relation, t) : t("trees.edges.setRelation")}
              </Button>
            </RelationMenu>
            <RelationMenu
              relationTypes={actions.relationTypes}
              onPick={(type) => actions.addJunctionRelative(id, type)}
            >
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("trees.edges.addJunction")}
                title={t("trees.edges.addJunction")}
              >
                <GitFork />
              </Button>
            </RelationMenu>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("trees.edges.reverse")}
              title={t("trees.edges.reverse")}
              disabled={data.junction}
              onClick={() => actions.reverseEdge(id)}
            >
              <ArrowLeftRight />
            </Button>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("trees.edges.lineStyle", { style: styleLabel })}
                  title={t("trees.edges.lineStyle", { style: styleLabel })}
                >
                  <LineSample style={lineStyle} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuRadioGroup
                  value={lineStyle}
                  onValueChange={(value) => actions.editEdge(id, { lineStyle: value as LineStyle })}
                >
                  {LINE_STYLES.map((style) => (
                    <DropdownMenuRadioItem key={style.value} value={style.value}>
                      <LineSample style={style.value} />
                      {t(style.label)}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("trees.edges.delete")}
              title={t("trees.edges.delete")}
              className="text-destructive"
              onClick={() => actions.removeEdge(id)}
            >
              <Trash2 />
            </Button>
          </div>
        </EdgeToolbar>
      )}
    </>
  );
});
