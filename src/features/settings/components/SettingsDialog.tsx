import {
  FolderOpen,
  Globe,
  Info,
  Languages,
  Library,
  type LucideIcon,
  Palette,
  RotateCcw,
} from "lucide-react";
import { Tabs } from "radix-ui";
import { type ReactNode, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { CORNER_RADIUS, useUiStore } from "@/app/stores/ui";
import { type ThemePreference, useImposedThemeValue } from "@/app/theme";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { MiddleTruncate } from "@/components/MiddleTruncate";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LibrarySection } from "@/features/media/components/LibrarySection";
import { isLanguage, LANGUAGES, type Language, type TranslationKey } from "@/i18n";
import { openDialog as pickFolder } from "@/lib/dialogs";
import { useDefaultWorldsDir } from "../hooks/useDefaultWorldsDir";
import { useSetDefaultWorldsDir } from "../hooks/useSetDefaultWorldsDir";
import { useSettings } from "../hooks/useSettings";
import { AboutSection } from "./AboutSection";

const THEMES: { value: ThemePreference; label: TranslationKey }[] = [
  { value: "light", label: "settings.theme.light" },
  { value: "dark", label: "settings.theme.dark" },
  { value: "system", label: "settings.theme.system" },
];

/** The corners' presets (#616), in percent of the designed radii; « Doux » is the default. */
const CORNER_PRESETS: { value: number; label: TranslationKey }[] = [
  { value: 0, label: "settings.corners.square" },
  { value: CORNER_RADIUS.default, label: "settings.corners.soft" },
  { value: 150, label: "settings.corners.round" },
];

const LANGUAGE_LABELS: Record<Language, TranslationKey> = {
  fr: "settings.language.fr",
  en: "settings.language.en",
};

type SectionId = "appearance" | "language" | "worlds" | "library" | "about";

const SECTIONS: { value: SectionId; icon: LucideIcon; label: TranslationKey }[] = [
  { value: "appearance", icon: Palette, label: "settings.appearance" },
  { value: "language", icon: Languages, label: "settings.language" },
  { value: "worlds", icon: Globe, label: "settings.sections.worlds" },
  { value: "library", icon: Library, label: "settings.sections.library" },
  { value: "about", icon: Info, label: "settings.about" },
];

function isThemePreference(value: string): value is ThemePreference {
  return THEMES.some((theme) => theme.value === value);
}

function isSection(value: string): value is SectionId {
  return SECTIONS.some((section) => section.value === value);
}

/** The content of a section, under its title (the world settings layout). */
function Panel({ value, children }: { value: SectionId; children: ReactNode }) {
  const { t } = useTranslation();
  const label = SECTIONS.find((section) => section.value === value)?.label;
  return (
    <Tabs.Content
      value={value}
      className="flex min-h-0 flex-col gap-4 overflow-y-auto p-5 text-sm outline-none"
    >
      {label && <h2 className="font-heading text-lg font-bold">{t(label)}</h2>}
      {children}
    </Tabs.Content>
  );
}

function AppearanceSection() {
  const { t } = useTranslation();
  const theme = useUiStore((state) => state.theme);
  const setTheme = useUiStore((state) => state.setTheme);
  const transparency = useUiStore((state) => state.transparency);
  const setTransparency = useUiStore((state) => state.setTransparency);
  const transparencyId = useId();
  const imposed = useImposedThemeValue();

  return (
    <>
      {imposed && (
        <p className="text-xs text-muted-foreground">{t(`settings.themeImposed.${imposed}`)}</p>
      )}
      <RadioGroup
        aria-label={t("settings.appearance")}
        value={theme}
        onValueChange={(value) => {
          if (isThemePreference(value)) setTheme(value);
        }}
        className="flex gap-4"
      >
        {THEMES.map(({ value, label }) => (
          <div key={value} className="flex items-center gap-2">
            <RadioGroupItem value={value} id={`theme-${value}`} />
            <Label htmlFor={`theme-${value}`}>{t(label)}</Label>
          </div>
        ))}
      </RadioGroup>
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <Label htmlFor={transparencyId}>{t("settings.transparency")}</Label>
          <p className="text-xs text-muted-foreground">{t("settings.transparencyHint")}</p>
        </div>
        <Switch
          id={transparencyId}
          checked={transparency === "on"}
          onCheckedChange={(checked) => setTransparency(checked ? "on" : "off")}
        />
      </div>
      <CornersSetting />
    </>
  );
}

/**
 * The corners of the whole interface (#616): three presets and a slider, in
 * percent of the designed radii. Applied at once (app/theme.ts), saved once
 * the slider settles.
 */
function CornersSetting() {
  const { t } = useTranslation();
  const cornerRadius = useUiStore((state) => state.cornerRadius);
  const setCornerRadius = useUiStore((state) => state.setCornerRadius);
  const sliderId = useId();
  const hintId = useId();
  const preset = CORNER_PRESETS.find((option) => option.value === cornerRadius);
  const value = t("settings.corners.value", { percent: cornerRadius });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <Label htmlFor={sliderId}>{t("settings.corners")}</Label>
        <p id={hintId} className="text-xs text-muted-foreground">
          {t("settings.corners.hint")}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <ToggleGroup
          type="single"
          aria-label={t("settings.corners.presets")}
          value={preset === undefined ? "" : String(preset.value)}
          onValueChange={(next) => {
            // A second click on the current preset keeps it.
            if (next !== "") setCornerRadius(Number(next));
          }}
        >
          {CORNER_PRESETS.map((option) => (
            <ToggleGroupItem key={option.value} value={String(option.value)} className="px-3">
              {t(option.label)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <input
          id={sliderId}
          type="range"
          min={CORNER_RADIUS.min}
          max={CORNER_RADIUS.max}
          step={10}
          value={cornerRadius}
          aria-valuetext={value}
          aria-describedby={hintId}
          onChange={(event) => setCornerRadius(event.target.valueAsNumber)}
          className="h-1.5 min-w-0 flex-1 cursor-pointer accent-primary"
        />
        <span aria-hidden className="w-12 text-right text-muted-foreground tabular-nums">
          {value}
        </span>
      </div>
    </div>
  );
}

function LanguageSection() {
  const { t, i18n } = useTranslation();
  return (
    <RadioGroup
      aria-label={t("settings.language")}
      value={i18n.resolvedLanguage ?? i18n.language}
      onValueChange={(value) => {
        if (isLanguage(value)) void i18n.changeLanguage(value);
      }}
      className="flex gap-4"
    >
      {LANGUAGES.map((language) => (
        <div key={language} className="flex items-center gap-2">
          <RadioGroupItem value={language} id={`language-${language}`} />
          <Label htmlFor={`language-${language}`} lang={language}>
            {t(LANGUAGE_LABELS[language])}
          </Label>
        </div>
      ))}
    </RadioGroup>
  );
}

function WorldsFolderSection() {
  const { t } = useTranslation();
  const settings = useSettings();
  const setFolder = useSetDefaultWorldsDir();
  const folder = settings.data?.defaultWorldsDir ?? null;
  // Without a chosen folder, the one Rust picks (it depends on the PC, ADR 0016).
  const fallback = useDefaultWorldsDir({ enabled: settings.isSuccess && folder === null });
  const shown =
    folder ??
    (fallback.data === undefined ? "" : t("settings.worldsDirDefault", { path: fallback.data }));
  const inputId = useId();

  const choose = async () => {
    const picked = await pickFolder({
      directory: true,
      multiple: false,
      title: t("settings.worldsDirPickerTitle"),
      ...(folder === null ? {} : { defaultPath: folder }),
    });
    if (typeof picked === "string") setFolder.mutate(picked);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={inputId}>{t("settings.worldsDir")}</Label>
      <div className="flex gap-2">
        {/* The field keeps the value; the path shows cut in its middle, as in « Nouveau monde ». */}
        <div className="relative min-w-0 flex-1">
          <Input
            id={inputId}
            readOnly
            value={shown}
            title={shown}
            className="text-transparent selection:text-transparent"
          />
          <MiddleTruncate
            text={shown}
            hidden
            className="pointer-events-none absolute inset-x-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground"
          />
        </div>
        <Button type="button" variant="secondary" onClick={choose}>
          <FolderOpen />
          {t("settings.worldsDirChoose")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={folder === null}
          onClick={() => setFolder.mutate(null)}
        >
          <RotateCcw />
          {t("settings.worldsDirReset")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t("settings.worldsDirHint")}</p>
      {setFolder.isError && <AppErrorMessage error={setFolder.error} />}
    </div>
  );
}

/** The rail and the open section. Mounted with the dialog, so it opens on Appearance. */
function SettingsSections({ open }: { open: boolean }) {
  const { t } = useTranslation();
  const [section, setSection] = useState<SectionId>("appearance");
  return (
    // Radix primitives, as in the world settings: the shadcn tabs are styled horizontal.
    <Tabs.Root
      orientation="vertical"
      value={section}
      onValueChange={(value) => {
        if (isSection(value)) setSection(value);
      }}
      className="grid min-h-0 flex-1 grid-cols-[12rem_minmax(0,1fr)] gap-0"
    >
      <Tabs.List
        aria-label={t("worldSettings.sectionsLabel")}
        className="flex flex-col gap-0.5 border-r border-border p-2"
      >
        {SECTIONS.map(({ value, icon: Icon, label }) => (
          <Tabs.Trigger
            key={value}
            value={value}
            className="flex h-9 items-center gap-2 rounded-md px-2.5 text-sm font-medium text-muted-foreground outline-none transition hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=active]:bg-accent data-[state=active]:text-foreground [&_svg]:size-4 [&_svg]:shrink-0"
          >
            <Icon aria-hidden />
            {t(label)}
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      <Panel value="appearance">
        <AppearanceSection />
      </Panel>
      <Panel value="language">
        <LanguageSection />
      </Panel>
      <Panel value="worlds">
        <WorldsFolderSection />
      </Panel>
      <Panel value="library">
        <LibrarySection enabled={open} />
      </Panel>
      <Panel value="about">
        <AboutSection enabled={open} />
      </Panel>
    </Tabs.Root>
  );
}

type SettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * App settings, stored in the app config folder (not in a world). Same layout
 * as the world settings: a rail of sections, the open section beside it.
 */
export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass flex h-[85vh] max-h-[40rem] flex-col gap-0 p-0 sm:max-w-3xl">
        <div className="flex flex-col gap-0.5 border-b border-border px-5 py-3 pr-12">
          <DialogTitle>{t("settings.title")}</DialogTitle>
          <DialogDescription className="text-xs">{t("settings.description")}</DialogDescription>
        </div>
        <SettingsSections open={open} />
      </DialogContent>
    </Dialog>
  );
}
