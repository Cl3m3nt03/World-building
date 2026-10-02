import type { Node, NodeProps } from "@xyflow/react";
import { UserRound } from "lucide-react";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { typeColor, typeIcon } from "@/features/card-types";
import { AssetImage } from "@/features/media";
import type { Card, CardType } from "@/lib/bindings";
import { cn } from "@/lib/utils";

/** What a node of the tree shows: a card, a plain name, or nothing yet. */
export type PersonData = {
  card: Card | null;
  type: CardType | null;
  /** The plain name (no card). */
  label: string;
};

export type PersonNodeType = Node<PersonData, "person">;

/** Width and height of a node, in tree units. */
export const NODE_WIDTH = 104;
export const NODE_HEIGHT = 128;

/**
 * A node of a relation tree (docs/features/05-relation-tree.md): the card's
 * image (or its type's icon) and name, a plain name, or an empty « New
 * character » waiting to be filled.
 */
export const PersonNode = memo(function PersonNode({ data, selected }: NodeProps<PersonNodeType>) {
  const { t } = useTranslation();
  const { card, type, label } = data;
  const empty = !card && label === "";
  const name = card ? card.title : empty ? t("trees.nodes.empty") : label;
  const Icon = card ? typeIcon(type?.icon ?? "shapes") : UserRound;

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1.5 rounded-lg border bg-card p-2 text-card-foreground shadow-sm",
        empty && "border-dashed bg-card/60 text-muted-foreground",
        selected ? "border-primary ring-2 ring-primary/40" : "border-border",
      )}
      style={{ width: NODE_WIDTH, height: NODE_HEIGHT }}
    >
      <div className="flex size-[72px] shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
        {card?.imageAssetId ? (
          <AssetImage assetId={card.imageAssetId} alt="" className="size-full object-cover" />
        ) : (
          <Icon
            aria-hidden
            className="size-8"
            style={card ? { color: typeColor(type?.color ?? "slate") } : undefined}
          />
        )}
      </div>
      <span className="line-clamp-2 w-full text-center text-xs leading-tight font-medium">
        {name}
      </span>
    </div>
  );
});
