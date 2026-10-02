import { Link, useParams } from "@tanstack/react-router";
import { ExternalLink, Link2, Trash2, Unlink } from "lucide-react";
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
import { ChoiceTiles, colorLabel, TYPE_COLORS, typeColor } from "@/features/card-types";
import { CardPicker } from "@/features/cards";
import type { Card, MapContent, MapZone, ZonePattern } from "@/lib/bindings";
import { ZONE_FONTS, ZONE_PATTERNS } from "../zones";

const PATTERN_LABELS = {
  solid: "maps.zones.pattern.solid",
  hatch: "maps.zones.pattern.hatch",
  dots: "maps.zones.pattern.dots",
  cross: "maps.zones.pattern.cross",
} as const satisfies Record<ZonePattern, string>;

const FONT_LABELS = {
  serif: "maps.fonts.serif",
  "sans-serif": "maps.fonts.sans",
  monospace: "maps.fonts.mono",
  cursive: "maps.fonts.cursive",
} as const satisfies Record<(typeof ZONE_FONTS)[number], string>;

/**
 * Properties of the selected zone (M4 step 4.6): label (text, font, size),
 * linked card, colour, opacity, fill pattern, layer. Its shape is edited on
 * the map (vertex handles).
 */
export function ZonePanel({
  zone,
  card,
  layers,
  onChange,
  onDelete,
}: {
  zone: MapZone;
  card: Card | undefined;
  layers: MapContent["layers"];
  onChange: (patch: Partial<MapZone>) => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const { worldId } = useParams({ from: "/world/$worldId" });
  const id = useId();

  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-3 border-t pt-3">
      <h2 id={`${id}-title`} className="text-sm font-medium">
        {t("maps.zones.title")}
      </h2>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${id}-label`}>{t("maps.zones.label")}</Label>
        <Input
          id={`${id}-label`}
          value={zone.label}
          maxLength={200}
          onChange={(event) => onChange({ label: event.target.value })}
          className="h-8"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${id}-font`}>{t("maps.zones.font")}</Label>
          <Select
            value={zone.labelStyle.font}
            onValueChange={(font) => onChange({ labelStyle: { ...zone.labelStyle, font } })}
          >
            <SelectTrigger id={`${id}-font`} size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ZONE_FONTS.map((font) => (
                <SelectItem key={font} value={font} style={{ fontFamily: font }}>
                  {t(FONT_LABELS[font])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${id}-size`}>{t("maps.zones.fontSize")}</Label>
          <Input
            id={`${id}-size`}
            type="number"
            min={8}
            max={96}
            value={zone.labelStyle.size ?? 18}
            onChange={(event) => {
              const size = Number(event.target.value);
              if (size >= 8 && size <= 96) onChange({ labelStyle: { ...zone.labelStyle, size } });
            }}
            className="h-8"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">{t("maps.zones.card")}</span>
        {zone.cardId && card ? (
          <div className="flex items-center gap-1">
            <Button asChild variant="secondary" size="xs" className="min-w-0 flex-1 justify-start">
              <Link to="/world/$worldId/world/card/$cardId" params={{ worldId, cardId: card.id }}>
                <ExternalLink />
                <span className="truncate">{card.title}</span>
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={t("maps.zones.unlink")}
              onClick={() => onChange({ cardId: null })}
            >
              <Unlink />
            </Button>
          </div>
        ) : (
          <CardPicker
            label={t("maps.zones.searchCard")}
            allowedTypeIds={[]}
            onPick={(cardId) => onChange({ cardId })}
          >
            <Button variant="secondary" size="xs" className="self-start">
              <Link2 />
              {t("maps.zones.link")}
            </Button>
          </CardPicker>
        )}
      </div>
      <ChoiceTiles
        label={t("maps.zones.color")}
        value={zone.fillColor}
        onChange={(fillColor) => onChange({ fillColor })}
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
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${id}-opacity`}>
          {t("maps.zones.opacity", { value: Math.round((zone.opacity ?? 0) * 100) })}
        </Label>
        <input
          id={`${id}-opacity`}
          type="range"
          min={0}
          max={100}
          step={5}
          value={Math.round((zone.opacity ?? 0) * 100)}
          onChange={(event) => onChange({ opacity: Number(event.target.value) / 100 })}
          className="accent-primary"
        />
      </div>
      <ChoiceTiles
        label={t("maps.zones.patternLabel")}
        value={zone.pattern}
        onChange={(pattern) => onChange({ pattern })}
        className="grid grid-cols-4 gap-1"
        tileClassName="h-7 px-1 text-xs"
        choices={ZONE_PATTERNS.map((pattern) => ({
          value: pattern,
          label: t(PATTERN_LABELS[pattern]),
          content: <span>{t(PATTERN_LABELS[pattern])}</span>,
        }))}
      />
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${id}-layer`}>{t("maps.pins.layer")}</Label>
        <Select value={zone.layerId} onValueChange={(layerId) => onChange({ layerId })}>
          <SelectTrigger id={`${id}-layer`} size="sm">
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
      <Button variant="ghost" size="sm" className="self-start text-destructive" onClick={onDelete}>
        <Trash2 />
        {t("maps.zones.delete")}
      </Button>
      <p className="text-xs text-muted-foreground">{t("maps.zones.editHint")}</p>
    </section>
  );
}
