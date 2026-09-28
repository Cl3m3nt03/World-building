import { Link2, type LucideIcon, ScanText, Sparkles, TriangleAlert } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useSetWorldPreferences } from "@/features/world";
import type { TranslationKey } from "@/i18n";
import type { WorldInfo, WorldPreferences } from "@/lib/bindings";
import { DeleteWorldDialog } from "./DeleteWorldDialog";

const PREFERENCES: {
  key: keyof WorldPreferences;
  icon: LucideIcon;
  label: TranslationKey;
  description: TranslationKey;
}[] = [
  {
    key: "entityDetection",
    icon: ScanText,
    label: "worldSettings.preferences.entityDetection",
    description: "worldSettings.preferences.entityDetectionHelp",
  },
  {
    key: "autoMentionLinks",
    icon: Link2,
    label: "worldSettings.preferences.autoMentionLinks",
    description: "worldSettings.preferences.autoMentionLinksHelp",
  },
  {
    key: "animateNewLinks",
    icon: Sparkles,
    label: "worldSettings.preferences.animateNewLinks",
    description: "worldSettings.preferences.animateNewLinksHelp",
  },
];

/** A preference: its switch, name and explanation. */
function PreferenceRow({
  icon: Icon,
  label,
  description,
  checked,
  onChange,
}: {
  icon: LucideIcon;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const labelId = useId();
  const descriptionId = useId();
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border p-4">
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span id={labelId} className="text-sm font-semibold">
          {label}
        </span>
        <p id={descriptionId} className="text-sm text-muted-foreground">
          {description}
        </p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
        className="mt-0.5"
      />
    </div>
  );
}

/** "Preferences" section of the world settings: writing preferences, then the danger zone. */
export function PreferencesSection({ world }: { world: WorldInfo }) {
  const { t } = useTranslation();
  const setPreferences = useSetWorldPreferences();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const dangerId = useId();

  return (
    <div className="flex flex-col gap-3">
      {PREFERENCES.map(({ key, icon, label, description }) => (
        <PreferenceRow
          key={key}
          icon={icon}
          label={t(label)}
          description={t(description)}
          checked={world.preferences[key]}
          onChange={(checked) => setPreferences.mutate({ ...world.preferences, [key]: checked })}
        />
      ))}
      {setPreferences.error && <AppErrorMessage error={setPreferences.error} />}

      <section
        aria-labelledby={dangerId}
        className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4"
      >
        <TriangleAlert aria-hidden className="size-5 shrink-0 text-destructive" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 id={dangerId} className="text-sm font-semibold">
            {t("worldSettings.danger.title")}
          </h3>
          <p className="text-sm text-muted-foreground">{t("worldSettings.danger.description")}</p>
        </div>
        <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
          {t("worldSettings.danger.deleteWorld")}
        </Button>
      </section>
      <DeleteWorldDialog world={world} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </div>
  );
}
