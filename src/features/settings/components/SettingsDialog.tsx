import { FolderOpen, RotateCcw } from "lucide-react";
import { type ReactNode, useId } from "react";
import { useTranslation } from "react-i18next";
import { useUiStore } from "@/app/stores/ui";
import type { ThemePreference } from "@/app/theme";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { LibrarySection } from "@/features/media/components/LibrarySection";
import { isLanguage, LANGUAGES, type Language, type TranslationKey } from "@/i18n";
import { openDialog as pickFolder } from "@/lib/dialogs";
import { useSetDefaultWorldsDir } from "../hooks/useSetDefaultWorldsDir";
import { useSettings } from "../hooks/useSettings";
import { AboutSection } from "./AboutSection";

const THEMES: { value: ThemePreference; label: TranslationKey }[] = [
  { value: "light", label: "settings.theme.light" },
  { value: "dark", label: "settings.theme.dark" },
  { value: "system", label: "settings.theme.system" },
];

const LANGUAGE_LABELS: Record<Language, TranslationKey> = {
  fr: "settings.language.fr",
  en: "settings.language.en",
};

function isThemePreference(value: string): value is ThemePreference {
  return THEMES.some((theme) => theme.value === value);
}

function Section({ title, children }: { title: TranslationKey; children: ReactNode }) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-3 border-t pt-4 first:border-t-0 first:pt-0"
    >
      <h3 id={id} className="text-sm font-bold">
        {t(title)}
      </h3>
      {children}
    </section>
  );
}

function AppearanceSection() {
  const { t } = useTranslation();
  const theme = useUiStore((state) => state.theme);
  const setTheme = useUiStore((state) => state.setTheme);
  const transparency = useUiStore((state) => state.transparency);
  const setTransparency = useUiStore((state) => state.setTransparency);
  const transparencyId = useId();

  return (
    <Section title="settings.appearance">
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
    </Section>
  );
}

function LanguageSection() {
  const { t, i18n } = useTranslation();
  return (
    <Section title="settings.language">
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
    </Section>
  );
}

function WorldsFolderSection() {
  const { t } = useTranslation();
  const settings = useSettings();
  const setFolder = useSetDefaultWorldsDir();
  const folder = settings.data?.defaultWorldsDir ?? null;
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
    <Section title="settings.worldsDir">
      <p className="text-xs text-muted-foreground">{t("settings.worldsDirHint")}</p>
      <div className="flex gap-2">
        <input
          id={inputId}
          aria-label={t("settings.worldsDir")}
          readOnly
          value={folder ?? t("settings.worldsDirDefault")}
          className="h-8 min-w-0 flex-1 rounded-md border bg-transparent px-2 font-mono text-xs"
        />
        <Button type="button" variant="secondary" size="sm" onClick={choose}>
          <FolderOpen />
          {t("settings.worldsDirChoose")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={folder === null}
          onClick={() => setFolder.mutate(null)}
        >
          <RotateCcw />
          {t("settings.worldsDirReset")}
        </Button>
      </div>
      {setFolder.isError && <AppErrorMessage error={setFolder.error} />}
    </Section>
  );
}

type SettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** App settings, stored in the app config folder (not in a world). */
export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("settings.title")}</DialogTitle>
          <DialogDescription>{t("settings.description")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <AppearanceSection />
          <LanguageSection />
          <WorldsFolderSection />
          <Section title="library.title">
            <LibrarySection enabled={open} />
          </Section>
          <Section title="settings.about">
            <AboutSection enabled={open} />
          </Section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
