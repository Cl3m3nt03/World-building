import { createContext, useContext } from "react";
import type { RelationType } from "@/lib/bindings";
import type { Direction } from "../relations";

/** What a node of the open tree can ask of the tree (its « + »). */
export type TreeActions = {
  relationTypes: RelationType[];
  /** Adds an empty node on that side of `nodeId`, linked by `type`. */
  addRelative: (nodeId: string, direction: Direction, type: RelationType | null) => void;
};

export const TreeActionsContext = createContext<TreeActions | null>(null);

export function useTreeActions(): TreeActions | null {
  return useContext(TreeActionsContext);
}
