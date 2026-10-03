import { FileQuestion } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { typeColor, typeIcon, useCardTypes } from "@/features/card-types";
import { typeLabel, useCardList } from "@/features/cards";
import { AssetImage } from "@/features/media";
import { cn } from "@/lib/utils";

/**
 * A card on a canvas, as on the board: its image (or its type's icon), its
 * type and its name. It follows the card (renamed, new image, new type);
 * a card in the trash or deleted shows « Card not found ». It only draws:
 * the pointer goes through to Excalidraw, which moves and selects it.
 */
export function CardThumbnail({ cardId }: { cardId: string }) {
  const { t } = useTranslation();
  const cards = useCardList(false);
  const types = useCardTypes();
  const card = useMemo(() => cards.data?.find((c) => c.id === cardId), [cards.data, cardId]);
  const all = types.data ?? [];
  const type = card?.typeId ? all.find((each) => each.id === card.typeId) : undefined;
  // Until the list is there, nothing is said to be missing.
  const missing = cards.isSuccess && !card;
  const Icon = missing ? FileQuestion : typeIcon(type?.icon ?? "shapes");

  return (
    <div
      className={cn(
        "bz-canvas-card flex size-full flex-col overflow-hidden rounded-lg border bg-background text-foreground shadow-sm",
        missing ? "border-dashed text-muted-foreground" : "border-border",
      )}
    >
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-muted">
        {card?.imageAssetId ? (
          <AssetImage assetId={card.imageAssetId} alt="" className="size-full object-cover" />
        ) : (
          <Icon
            aria-hidden
            className="size-10"
            style={card ? { color: typeColor(type?.color ?? "slate") } : undefined}
          />
        )}
      </div>
      <div className="flex flex-col gap-0.5 px-2.5 py-2">
        {type && (
          <span className="truncate text-[10px] text-muted-foreground uppercase">
            {typeLabel(type, all)}
          </span>
        )}
        <span className="truncate font-heading text-sm font-bold">
          {missing ? t("canvases.cards.missing") : (card?.title ?? "")}
        </span>
      </div>
    </div>
  );
}
