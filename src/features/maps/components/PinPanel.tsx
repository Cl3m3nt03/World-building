import { Link, useParams } from "@tanstack/react-router";
import { ExternalLink, Trash2 } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChoiceTiles,
  colorLabel,
  TYPE_COLORS,
  TYPE_ICON_NAMES,
  typeColor,
  typeIcon,
} from "@/features/card-types";
import { AssetImage } from "@/features/media";
import type { Card, MapContent, MapPin } from "@/lib/bindings";
import { PIN_SIZES } from "../pins";

type PinPanelProps = {
  pin: MapPin;
  card: Card | undefined;
  /** The card was deleted for good: the pin keeps a dead reference. */
  layers: MapContent["layers"];
  onChange: (patch: Partial<MapPin>) => void;
  onDelete: () => void;
};

/**
 * Properties of the selected pin (M4 step 4.5). A pin tied to a card shows
 * the card (image, name, Open); a plain marker has its own label, icon and
 * colour. Both have a size and a layer.
 */
export function PinPanel({ pin, card, layers, onChange, onDelete }: PinPanelProps) {
  const { t } = useTranslation();
  const { worldId } = useParams({ from: "/world/$worldId" });
  const labelId = useId();
  const sizeId = useId();
  const layerId = useId();

  return (
    <section aria-labelledby={`${labelId}-title`} className="flex flex-col gap-3 border-t pt-3">
      <h2 id={`${labelId}-title`} className="text-sm font-medium">
        {card ? t("maps.pins.cardPin") : t("maps.pins.marker")}
      </h2>
      {pin.cardId !== null &&
        (card ? (
          <div className="flex items-center gap-2">
            <div className="size-12 shrink-0 overflow-hidden rounded-md bg-muted">
              {card.imageAssetId && (
                <AssetImage assetId={card.imageAssetId} alt="" className="size-full object-cover" />
              )}
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="truncate text-sm font-medium">{card.title}</span>
              <Button asChild variant="secondary" size="xs">
                <Link to="/world/$worldId/world/card/$cardId" params={{ worldId, cardId: card.id }}>
                  <ExternalLink />
                  {t("maps.pins.open")}
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t("maps.pins.deadCard")}</p>
        ))}
      {pin.cardId === null && (
        <>
          <div className="flex flex-col gap-1">
            <Label htmlFor={labelId}>{t("maps.pins.label")}</Label>
            <Input
              id={labelId}
              value={pin.label}
              maxLength={200}
              onChange={(event) => onChange({ label: event.target.value })}
              className="h-8"
            />
          </div>
          <ChoiceTiles
            label={t("maps.pins.color")}
            value={pin.color}
            onChange={(color) => onChange({ color })}
            className="grid grid-cols-9 gap-1"
            tileClassName="size-5 rounded-full"
            choices={TYPE_COLORS.map((color) => ({
              value: color,
              label: t(colorLabel(color)),
              content: (
                <span
                  aria-hidden
                  className="size-full rounded-full"
                  style={{ backgroundColor: typeColor(color) }}
                />
              ),
            }))}
          />
          <ChoiceTiles
            label={t("maps.pins.icon")}
            value={pin.icon}
            onChange={(icon) => onChange({ icon })}
            className="grid max-h-32 grid-cols-7 gap-1 overflow-y-auto"
            tileClassName="size-7"
            choices={TYPE_ICON_NAMES.map((name) => {
              const Icon = typeIcon(name);
              return { value: name, label: name, content: <Icon aria-hidden className="size-4" /> };
            })}
          />
        </>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor={sizeId}>{t("maps.pins.size")}</Label>
          <Select
            value={String(pin.size)}
            onValueChange={(size) => onChange({ size: Number(size) })}
          >
            <SelectTrigger id={sizeId} size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PIN_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {t("maps.pins.sizeValue", { size: Math.round(size * 100) })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={layerId}>{t("maps.pins.layer")}</Label>
          <Select value={pin.layerId} onValueChange={(next) => onChange({ layerId: next })}>
            <SelectTrigger id={layerId} size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[...layers].reverse().map((layer) => (
                <SelectItem key={layer.id} value={layer.id}>
                  {layer.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button variant="ghost" size="sm" className="self-start text-destructive" onClick={onDelete}>
        <Trash2 />
        {t("maps.pins.delete")}
      </Button>
      <p className="text-xs text-muted-foreground">{t("maps.pins.keyboardHint")}</p>
    </section>
  );
}
