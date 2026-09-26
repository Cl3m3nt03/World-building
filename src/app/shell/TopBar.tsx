import { BookOpen, Feather, Globe, House, LayoutGrid, type LucideIcon, Radio } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AssetImage } from "@/features/media";
import { SettingsButton } from "@/features/settings";
import { useCloseWorld, useCurrentWorld, WorldPanel } from "@/features/world";
import type { TranslationKey } from "@/i18n";

export type ShellTab = "home" | "world" | "wiki" | "quill";

const TABS: { value: ShellTab; icon: LucideIcon; label: TranslationKey }[] = [
  { value: "home", icon: House, label: "shell.tabs.home" },
  { value: "world", icon: Globe, label: "shell.tabs.world" },
  { value: "wiki", icon: BookOpen, label: "shell.tabs.wiki" },
  { value: "quill", icon: Feather, label: "shell.tabs.quill" },
];

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
  const { t } = useTranslation();
  const { data: world } = useCurrentWorld();
  const closeWorld = useCloseWorld();
  const [panelOpen, setPanelOpen] = useState(false);
  return (
    <header className="grid h-10 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2">
      {/* Left island: current world */}
      <div className="justify-self-start">
        <Button
          variant="ghost"
          aria-label={t("shell.world.label", { name: world?.name ?? "" })}
          aria-haspopup="dialog"
          aria-expanded={panelOpen}
          onClick={() => setPanelOpen(true)}
          disabled={!world}
          className="glass h-10 max-w-64 rounded-lg px-2.5 font-heading text-sm"
        >
          {world?.mainImage ? (
            <AssetImage
              assetId={world.mainImage}
              alt=""
              className="size-5 shrink-0 rounded-sm object-cover"
            />
          ) : (
            <span aria-hidden className="size-5 shrink-0 rounded-sm bg-primary/80" />
          )}
          <span className="truncate">{world?.name}</span>
        </Button>
        {world && <WorldPanel world={world} open={panelOpen} onOpenChange={setPanelOpen} />}
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

        <SettingsButton />

        <Button
          variant="secondary"
          size="sm"
          className="ml-0.5 rounded-full"
          onClick={() => closeWorld.mutate()}
          disabled={closeWorld.isPending}
        >
          <LayoutGrid />
          {t("shell.actions.worlds")}
        </Button>
      </nav>
    </header>
  );
}
