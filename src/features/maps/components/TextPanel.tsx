import { Trash2 } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import type { MapContent, MapText, TextStyle } from "@/lib/bindings";
import { ZONE_FONTS } from "../zones";

const FONT_LABELS = {
  serif: "maps.fonts.serif",
  "sans-serif": "maps.fonts.sans",
  monospace: "maps.fonts.mono",
  cursive: "maps.fonts.cursive",
} as const satisfies Record<(typeof ZONE_FONTS)[number], string>;

/**
 * Properties of the selected text (M4 step 4.7): the text itself (focused
 * when it was just placed), font, size, whether it follows the zoom,
 * letter spacing, arc, layer.
 */
export function TextPanel({
  text,
  layers,
  autoFocus,
  onChange,
  onDelete,
}: {
  text: MapText;
  layers: MapContent["layers"];
  autoFocus: boolean;
  onChange: (patch: Partial<MapText>) => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const style = (patch: Partial<TextStyle>) => onChange({ style: { ...text.style, ...patch } });

  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-3 border-t pt-3">
      <h2 id={`${id}-title`} className="text-sm font-medium">
        {t("maps.texts.title")}
      </h2>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${id}-text`}>{t("maps.texts.text")}</Label>
        <Input
          id={`${id}-text`}
          autoFocus={autoFocus}
          value={text.text}
          maxLength={200}
          onFocus={(event) => autoFocus && event.target.select()}
          onChange={(event) => onChange({ text: event.target.value })}
          className="h-8"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${id}-font`}>{t("maps.zones.font")}</Label>
          <Select value={text.style.font} onValueChange={(font) => style({ font })}>
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
            max={200}
            value={text.style.size ?? 28}
            onChange={(event) => {
              const size = Number(event.target.value);
              if (size >= 8 && size <= 200) style({ size });
            }}
            className="h-8"
          />
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={`${id}-zoom`}>{t("maps.texts.scaleWithZoom")}</Label>
        <Switch
          id={`${id}-zoom`}
          checked={text.style.scaleWithZoom}
          onCheckedChange={(scaleWithZoom) => style({ scaleWithZoom })}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${id}-spacing`}>
          {t("maps.texts.spacing", { value: (text.style.spacing ?? 0).toFixed(1) })}
        </Label>
        <input
          id={`${id}-spacing`}
          type="range"
          min={-0.2}
          max={2}
          step={0.1}
          value={text.style.spacing ?? 0}
          onChange={(event) => style({ spacing: Number(event.target.value) })}
          className="accent-primary"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${id}-arc`}>
          {t("maps.texts.arc", { value: Math.round((text.style.arc ?? 0) * 100) })}
        </Label>
        <input
          id={`${id}-arc`}
          type="range"
          min={-1}
          max={1}
          step={0.05}
          value={text.style.arc ?? 0}
          onChange={(event) => style({ arc: Number(event.target.value) })}
          className="accent-primary"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${id}-layer`}>{t("maps.pins.layer")}</Label>
        <Select value={text.layerId} onValueChange={(layerId) => onChange({ layerId })}>
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
        {t("maps.texts.delete")}
      </Button>
    </section>
  );
}
