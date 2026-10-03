import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import { Plus, UserRound } from "lucide-react";
import { Fragment, memo } from "react";
import { useTranslation } from "react-i18next";
import { typeColor, typeIcon } from "@/features/card-types";
import { AssetImage } from "@/features/media";
import type { Card, CardType } from "@/lib/bindings";
import { cn } from "@/lib/utils";
import { NODE_HEIGHT, NODE_WIDTH } from "../content";
import type { Direction } from "../relations";
import { RelationMenu } from "./RelationMenu";
import { useTreeActions } from "./treeActions";

/** What a node of the tree shows: a card, a plain name, or nothing yet. */
export type PersonData = {
  card: Card | null;
  /** Its card is in the trash or deleted. */
  missing: boolean;
  type: CardType | null;
  /** The plain name (no card). */
  label: string;
};

export type PersonNodeType = Node<PersonData, "person">;

/** Where the links attach (one per side); a link takes the sides facing each other. */
const SIDES: { direction: Direction; position: Position; plus: string }[] = [
  { direction: "top", position: Position.Top, plus: "-top-9 left-1/2 -translate-x-1/2" },
  { direction: "right", position: Position.Right, plus: "top-1/2 -right-9 -translate-y-1/2" },
  { direction: "bottom", position: Position.Bottom, plus: "-bottom-12 left-1/2 -translate-x-1/2" },
  { direction: "left", position: Position.Left, plus: "top-1/2 -left-9 -translate-y-1/2" },
];

const PLUS_LABELS = {
  top: "trees.relations.addTop",
  right: "trees.relations.addRight",
  bottom: "trees.relations.addBottom",
  left: "trees.relations.addLeft",
} as const;

/**
 * A node of a relation tree (docs/features/05-relation-tree.md): the card's
 * image (or its type's icon) and name, a plain name, or an empty « New
 * character » waiting to be filled. Selected, it has a « + » on each side
 * to add a relative there.
 */
export const PersonNode = memo(function PersonNode({
  id,
  data,
  selected,
}: NodeProps<PersonNodeType>) {
  const { t } = useTranslation();
  const actions = useTreeActions();
  const { card, type, label, missing } = data;
  const empty = !card && !missing && label === "";
  const name = card
    ? card.title
    : missing
      ? t("trees.nodes.missing")
      : empty
        ? t("trees.nodes.empty")
        : label;
  const Icon = card ? typeIcon(type?.icon ?? "shapes") : UserRound;

  return (
    <div className="relative" style={{ width: NODE_WIDTH, height: NODE_HEIGHT }}>
      <div
        className={cn(
          "flex size-full items-center justify-center overflow-hidden rounded-lg border bg-background text-foreground shadow-sm",
          (empty || missing) && "border-dashed text-muted-foreground",
          selected ? "border-primary ring-2 ring-primary/40" : "border-border",
        )}
      >
        {card?.imageAssetId ? (
          <AssetImage assetId={card.imageAssetId} alt="" className="size-full object-cover" />
        ) : (
          <Icon
            aria-hidden
            className="size-9"
            style={card ? { color: typeColor(type?.color ?? "slate") } : undefined}
          />
        )}
      </div>
      {/* The name sits on the bottom edge, as a badge. */}
      <span
        className={cn(
          "absolute -bottom-2.5 left-1/2 max-w-[132px] -translate-x-1/2 truncate rounded-md border bg-background px-2 py-0.5 text-xs font-medium whitespace-nowrap text-foreground shadow-sm",
          selected ? "border-primary" : "border-border",
          (empty || missing) && "text-muted-foreground",
        )}
      >
        {name}
      </span>
      {SIDES.map(({ direction, position }) => (
        <Fragment key={direction}>
          <Handle
            id={direction}
            type="source"
            position={position}
            className="bz-tree-handle"
            // Below the name's badge, so a link leaving down does not cross it.
            style={direction === "bottom" ? { bottom: -14 } : undefined}
          />
          {/* Its twin as a target: dragging a link's start end looks for one. Links are only drawn from the source. */}
          <Handle
            id={direction}
            type="target"
            position={position}
            isConnectableStart={false}
            className="bz-tree-handle pointer-events-none"
            style={direction === "bottom" ? { bottom: -14 } : undefined}
          />
        </Fragment>
      ))}
      {selected &&
        actions &&
        SIDES.map(({ direction, plus }) => (
          <RelationMenu
            key={direction}
            side={direction}
            relationTypes={actions.relationTypes}
            onManage={actions.manageRelations}
            onPick={(type) => actions.addRelative(id, direction, type)}
          >
            <button
              type="button"
              aria-label={t(PLUS_LABELS[direction], { name })}
              title={t(PLUS_LABELS[direction], { name })}
              className={cn(
                "nodrag nopan glass absolute flex size-6 items-center justify-center rounded-full border border-border text-muted-foreground shadow-sm outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                plus,
              )}
            >
              <Plus aria-hidden className="size-3.5" />
            </button>
          </RelationMenu>
        ))}
    </div>
  );
});
