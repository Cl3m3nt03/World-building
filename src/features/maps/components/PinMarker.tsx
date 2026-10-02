import { typeColor, typeIcon } from "@/features/card-types";
import { AssetImage } from "@/features/media";
import type { Card, CardType, MapPin } from "@/lib/bindings";
import { cn } from "@/lib/utils";

/** Diameter of a pin of size 1, in px. */
const BASE_SIZE = 32;

/**
 * What a pin looks like on the map: a disc with the card's image (or its
 * type's icon), or for a plain marker its own icon and colour, with the
 * label under it. Rendered into the Leaflet marker (MapView), centred on
 * the pin's position.
 */
export function PinMarker({
  pin,
  card,
  type,
  selected,
}: {
  pin: MapPin;
  card: Card | undefined;
  type: CardType | undefined;
  selected: boolean;
}) {
  const size = BASE_SIZE * (pin.size ?? 1);
  const Icon = typeIcon(card ? (type?.icon ?? "shapes") : pin.icon);
  const color = typeColor(card ? (type?.color ?? "slate") : pin.color);
  const label = card ? card.title : pin.label;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5"
    >
      <div
        style={{
          width: size,
          height: size,
          backgroundColor: card?.imageAssetId ? undefined : color,
        }}
        className={cn(
          "pointer-events-auto flex items-center justify-center overflow-hidden rounded-full border-2 border-background text-white shadow-md",
          selected && "ring-3 ring-primary",
        )}
      >
        {card?.imageAssetId ? (
          <AssetImage assetId={card.imageAssetId} alt="" className="size-full object-cover" />
        ) : (
          <Icon style={{ width: size * 0.55, height: size * 0.55 }} />
        )}
      </div>
      {label && (
        <span className="rounded-sm bg-background/80 px-1 text-xs whitespace-nowrap text-foreground shadow-sm">
          {label}
        </span>
      )}
    </div>
  );
}
