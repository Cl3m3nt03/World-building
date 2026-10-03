import { createContext, useContext } from "react";
import type { RelationType, TreeEdge } from "@/lib/bindings";
import type { Direction } from "../relations";

/** What the nodes and links of the open tree can ask of it. */
export type TreeActions = {
  relationTypes: RelationType[];
  /** Adds an empty node on that side of `nodeId`, linked by `type`. */
  addRelative: (nodeId: string, direction: Direction, type: RelationType | null) => void;
  /** Changes a link's relation type or line style. */
  editEdge: (id: string, patch: Partial<Pick<TreeEdge, "relationTypeId" | "lineStyle">>) => void;
  /** Turns a link round. */
  reverseEdge: (id: string) => void;
  /** Removes a link and the junctions hanging from it. */
  removeEdge: (id: string) => void;
  /** Adds an empty node below link `edgeId`'s middle, hung from it by `type` (a junction). */
  addJunctionRelative: (edgeId: string, type: RelationType | null) => void;
  /** Opens the window managing the world's relation types. */
  manageRelations: () => void;
  /** The link whose relation list is open (a link just drawn opens it). */
  relationMenuFor: string | null;
  setRelationMenuFor: (id: string | null) => void;
};

export const TreeActionsContext = createContext<TreeActions | null>(null);

export function useTreeActions(): TreeActions | null {
  return useContext(TreeActionsContext);
}
