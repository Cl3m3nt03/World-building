import { Link } from "@tanstack/react-router";
import {
  BookOpen,
  Feather,
  Globe,
  House,
  LayoutGrid,
  type LucideIcon,
  Radio,
  Settings,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useUiStore } from "@/app/stores/ui";
import type { ThemePreference } from "@/app/theme";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { isLanguage, LANGUAGES, type Language, type TranslationKey } from "@/i18n";

export type ShellTab = "home" | "world" | "wiki" | "quill";

const TABS: { value: ShellTab; icon: LucideIcon; label: TranslationKey }[] = [
  { value: "home", icon: House, label: "shell.tabs.home" },
  { value: "world", icon: Globe, label: "shell.tabs.world" },
  { value: "wiki", icon: BookOpen, label: "shell.tabs.wiki" },
  { value: "quill", icon: Feather, label: "shell.tabs.quill" },
];

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

type TopBarProps = {
  activeTab: ShellTab;
};

function IconAction({ icon: Icon, label }: { icon: LucideIcon; label: TranslationKey }) {
  const { t } = useTranslation();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={t(label)} className="rounded-full">
          <Icon />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{t(label)}</TooltipContent>
    </Tooltip>
  );
}

export function TopBar({ activeTab }: TopBarProps) {
  const { t, i18n } = useTranslation();
  const theme = useUiStore((state) => state.theme);
  const setTheme = useUiStore((state) => state.setTheme);
  const transparency = useUiStore((state) => state.transparency);
  const setTransparency = useUiStore((state) => state.setTransparency);
  return (
    <header className="grid h-10 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2">
      {/* Left island: current world */}
      <div className="justify-self-start">
        <Button
          variant="ghost"
          aria-label={t("shell.world.label")}
          className="glass h-10 rounded-lg px-2.5 font-heading text-sm"
        >
          <span aria-hidden className="size-5 rounded-sm bg-primary/80" />
          {t("shell.world.placeholderName")}
        </Button>
      </div>

      {/* Center island: modes */}
      <TabsList
        aria-label={t("shell.tabs.label")}
        className="glass h-10 gap-0.5 rounded-full p-1 group-data-horizontal/tabs:h-10"
      >
        {TABS.map(({ value, icon: Icon, label }) => {
          const active = value === activeTab;
          const trigger = (
            <TabsTrigger
              key={value}
              value={value}
              aria-label={t(label)}
              className="h-8 flex-none rounded-full px-3 text-muted-foreground data-[state=active]:bg-secondary data-[state=active]:text-foreground data-[state=active]:shadow-none dark:data-[state=active]:bg-secondary"
            >
              <Icon />
              {active && <span>{t(label)}</span>}
            </TabsTrigger>
          );
          return active ? (
            trigger
          ) : (
            <Tooltip key={value}>
              <TooltipTrigger asChild>{trigger}</TooltipTrigger>
              <TooltipContent>{t(label)}</TooltipContent>
            </Tooltip>
          );
        })}
      </TabsList>

      {/* Right island: actions */}
      <nav
        aria-label={t("shell.actions.label")}
        className="glass flex h-10 items-center gap-0.5 justify-self-end rounded-full px-1"
      >
        <IconAction icon={Radio} label="shell.actions.radio" />

        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("shell.actions.settings")}
                  className="rounded-full"
                >
                  <Settings />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>{t("shell.actions.settings")}</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{t("settings.appearance")}</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={theme}
              onValueChange={(value) => {
                if (isThemePreference(value)) setTheme(value);
              }}
            >
              {THEMES.map(({ value, label }) => (
                <DropdownMenuRadioItem key={value} value={value}>
                  {t(label)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={transparency === "on"}
              onCheckedChange={(checked) => setTransparency(checked ? "on" : "off")}
            >
              {t("settings.transparency")}
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{t("settings.language")}</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={i18n.resolvedLanguage ?? i18n.language}
              onValueChange={(value) => {
                if (isLanguage(value)) void i18n.changeLanguage(value);
              }}
            >
              {LANGUAGES.map((language) => (
                <DropdownMenuRadioItem key={language} value={language} lang={language}>
                  {t(LANGUAGE_LABELS[language])}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button asChild variant="secondary" size="sm" className="ml-0.5 rounded-full">
          <Link to="/">
            <LayoutGrid />
            {t("shell.actions.worlds")}
          </Link>
        </Button>
      </nav>
    </header>
  );
}
