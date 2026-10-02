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
  /** Its card is in the trash or deleted. */
  missing: boolean;
  type: CardType | null;
  /** The plain name (no card). */
  label: string;
};

export type PersonNodeType = Node<PersonData, "person">;

/** Width and height of a node, in tree units. */
export const NODE_WIDTH = 96;
export const NODE_HEIGHT = 120;

/**
 * A node of a relation tree (docs/features/05-relation-tree.md): the card's
 * image (or its type's icon) and name, a plain name, or an empty « New
 * character » waiting to be filled.
 */
export const PersonNode = memo(function PersonNode({ data, selected }: NodeProps<PersonNodeType>) {
  const { t } = useTranslation();
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
    </div>
  );
});
