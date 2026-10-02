import { Settings2 } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import type { TranslationKey } from "@/i18n";
import { DEFAULT_SETTINGS, type Settings } from "../settings";

type NumberSetting = Exclude<keyof Settings, "showLabels" | "hideIsolated">;

/** The sliders: bounds of the Rust side (src-tauri/src/domain/graphs.rs) and steps. */
const SLIDERS: {
  key: NumberSetting;
  label: TranslationKey;
  min: number;
  max: number;
  step: number;
}[] = [
  { key: "nodeSize", label: "graphs.settings.nodeSize", min: 0.25, max: 4, step: 0.25 },
  { key: "linkDistance", label: "graphs.settings.linkDistance", min: 5, max: 500, step: 5 },
  { key: "linkStrength", label: "graphs.settings.linkStrength", min: 0, max: 2, step: 0.05 },
  { key: "repulsion", label: "graphs.settings.repulsion", min: 0, max: 2000, step: 10 },
  { key: "collision", label: "graphs.settings.collision", min: 0, max: 3, step: 0.1 },
  { key: "gravityX", label: "graphs.settings.gravityX", min: 0, max: 1, step: 0.01 },
  { key: "gravityY", label: "graphs.settings.gravityY", min: 0, max: 1, step: 0.01 },
];

/** A setting's value as shown next to its name (no needless decimals). */
function shown(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/**
 * The graph's settings (docs/features/04-graph.md): labels, isolated nodes,
 * node size and the forces. Each change moves the graph gently.
 */
export function GraphSettingsPanel({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (change: Partial<Settings>) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const changed = (Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]).some(
    (key) => settings[key] !== DEFAULT_SETTINGS[key],
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("graphs.settings.button")}
          title={t("graphs.settings.button")}
        >
          <Settings2 />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" className="flex w-72 flex-col gap-3">
        <h2 className="text-sm font-medium">{t("graphs.settings.title")}</h2>
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={`${id}-labels`}>{t("graphs.settings.showLabels")}</Label>
          <Switch
            id={`${id}-labels`}
            checked={settings.showLabels}
            onCheckedChange={(showLabels) => onChange({ showLabels })}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={`${id}-isolated`}>{t("graphs.settings.hideIsolated")}</Label>
          <Switch
            id={`${id}-isolated`}
            checked={settings.hideIsolated}
            onCheckedChange={(hideIsolated) => onChange({ hideIsolated })}
          />
        </div>
        {SLIDERS.map(({ key, label, min, max, step }) => (
          <div key={key} className="flex flex-col gap-1">
            <Label htmlFor={`${id}-${key}`} className="justify-between">
              <span>{t(label)}</span>
              <span className="text-muted-foreground tabular-nums">{shown(settings[key])}</span>
            </Label>
            <input
              id={`${id}-${key}`}
              type="range"
              min={min}
              max={max}
              step={step}
              value={settings[key]}
              onChange={(event) => onChange({ [key]: Number(event.target.value) })}
              className="accent-primary"
            />
          </div>
        ))}
        <Button
          variant="secondary"
          size="sm"
          disabled={!changed}
          onClick={() => onChange(DEFAULT_SETTINGS)}
        >
          {t("graphs.settings.reset")}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
