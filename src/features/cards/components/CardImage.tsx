import { ImagePlus, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import { AssetImage, ImagePickerDialog } from "@/features/media";
import type { Card, CardType } from "@/lib/bindings";
import { cn } from "@/lib/utils";
import { useSetCardImage } from "../hooks/useCards";

/**
 * A card's image: a click chooses it in the media library; it can be removed.
 * `className` sets its width (World: by the type's orientation).
 */
export function CardImage({
  card,
  type,
  className,
}: {
  card: Card;
  type: CardType | undefined;
  className?: string;
}) {
  const { t } = useTranslation();
  const setImage = useSetCardImage(card.id);
  const [picking, setPicking] = useState(false);
  const landscape = type?.orientation === "landscape";

  return (
    <div className={cn("flex shrink-0 flex-col gap-2", className ?? (landscape ? "w-72" : "w-44"))}>
      <button
        type="button"
        onClick={() => setPicking(true)}
        aria-label={card.imageAssetId ? t("cards.changeImage") : t("cards.chooseImage")}
        className={cn(
          "group relative overflow-hidden rounded-xl border border-border bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          landscape ? "aspect-video" : "aspect-[3/4]",
        )}
      >
        {card.imageAssetId ? (
          <AssetImage assetId={card.imageAssetId} alt="" className="size-full object-cover" />
        ) : (
          <span className="flex size-full flex-col items-center justify-center gap-1 text-xs text-muted-foreground group-hover:text-foreground">
            <ImagePlus aria-hidden className="size-6" />
            {t("cards.chooseImage")}
          </span>
        )}
      </button>
      {card.imageAssetId && (
        <Button variant="ghost" size="sm" onClick={() => setImage.mutate(null)}>
          <X />
          {t("cards.removeImage")}
        </Button>
      )}
      {setImage.isError && <AppErrorMessage error={setImage.error} />}
      <ImagePickerDialog
        open={picking}
        onOpenChange={setPicking}
        selectedId={card.imageAssetId}
        onPick={(assetId) => setImage.mutate(assetId)}
      />
    </div>
  );
}
