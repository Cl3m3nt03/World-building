import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import { memo } from "react";
import { cn } from "@/lib/utils";
import { JUNCTION_SIZE } from "../geometry";

export type JunctionData = {
  /** The link it is the middle of. */
  edgeId: string;
  /** Shown: its link is hovered or selected, or junctions hang from it. */
  visible: boolean;
};

export type JunctionNodeType = Node<JunctionData, "junction">;

/** The node id of the middle of link `edgeId`. */
export const junctionId = (edgeId: string) => `junction:${edgeId}`;

/** The link whose middle the node `nodeId` is, if it is one. */
export function junctionEdge(nodeId: string): string | null {
  return nodeId.startsWith("junction:") ? nodeId.slice("junction:".length) : null;
}

const SIDES = [Position.Top, Position.Right, Position.Bottom, Position.Left];

/**
 * The middle of a link, where junctions start (a child hanging from its
 * parents' link): a point to draw a line from. Not part of the content:
 * it follows its link.
 */
export const JunctionNode = memo(function JunctionNode({ data }: NodeProps<JunctionNodeType>) {
  return (
    <div
      className={cn("bz-tree-junction relative rounded-full", data.visible && "bz-visible")}
      style={{ width: JUNCTION_SIZE, height: JUNCTION_SIZE }}
    >
      {SIDES.map((position) => (
        <Handle
          key={position}
          id={position}
          type="source"
          position={position}
          className="bz-tree-junction-handle"
        />
      ))}
    </div>
  );
});
