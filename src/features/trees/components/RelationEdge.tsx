import {
  BaseEdge,
  type Edge,
  EdgeLabelRenderer,
  type EdgeProps,
  getSmoothStepPath,
} from "@xyflow/react";
import { memo } from "react";
import type { LineStyle } from "@/lib/bindings";

export type RelationEdgeData = {
  lineStyle: LineStyle;
  /** What the link says, in its direction (« Arathorn: parent of Aragorn »). */
  tooltip: string;
  /** Hovered: the tooltip shows (it also shows while the link is selected). */
  hovered: boolean;
};

export type RelationEdgeType = Edge<RelationEdgeData, "relation">;

const DASHES: Record<LineStyle, string | undefined> = {
  solid: undefined,
  dashed: "8 6",
  dotted: "1 6",
};

/** A link of a relation tree: square corners, its line style, a tooltip. */
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
      {data && (data.hovered || selected) && (
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
    </>
  );
});
