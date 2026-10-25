import { BookOpen, Feather, Globe, House, LayoutGrid, type LucideIcon, Search } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useUiStore } from "@/app/stores/ui";
import { Button } from "@/components/ui/button";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RadioButton } from "@/features/radio";
import { SettingsButton } from "@/features/settings";
import { useCloseWorld, useCurrentWorld } from "@/features/world";
import type { TranslationKey } from "@/i18n";
import { WorldIsland } from "./WorldIsland";
import { RailToggle } from "./WorldRail";

export type ShellTab = "home" | "world" | "wiki" | "quill";

const TABS: { value: ShellTab; icon: LucideIcon; label: TranslationKey }[] = [
  { value: "home", icon: House, label: "shell.tabs.home" },
  { value: "world", icon: Globe, label: "shell.tabs.world" },
  { value: "wiki", icon: BookOpen, label: "shell.tabs.wiki" },
  { value: "quill", icon: Feather, label: "shell.tabs.quill" },
];

type TopBarProps = {
  activeTab: ShellTab;
  /**
   * A tab was clicked. Also called for the tab already shown: from a page
   * inside it (the media library, under Home), it leads back to the tab.
   */
  onTabClick: (tab: ShellTab) => void;
  /** The global search (Ctrl+K): the World tab and its search field. */
  onSearch: () => void;
};

/**
 * The pill under the active tab, which slides from one tab to the next (V2):
 * its place is measured on the active trigger, again when the window or the
 * labels change size.
 */
function useActivePill(activeTab: ShellTab) {
  const listRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => {
      const active = list.querySelector<HTMLElement>(`[data-tab="${activeTab}"]`);
      if (active) setPill({ left: active.offsetLeft, width: active.offsetWidth });
    };
    measure();
    const observer = new ResizeObserver(measure);
    for (const trigger of list.querySelectorAll("[data-tab]")) observer.observe(trigger);
    return () => observer.disconnect();
  }, [activeTab]);
  return { listRef, pill };
}

export function TopBar({ activeTab, onTabClick, onSearch }: TopBarProps) {
  const { t } = useTranslation();
  const { data: world } = useCurrentWorld();
  const closeWorld = useCloseWorld();
  const { listRef, pill } = useActivePill(activeTab);
  const railShown = useUiStore((state) => state.worldRail);
  return (
    <header className="grid h-10 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2">
      {/* Left island: current world */}
      <div className="flex items-center gap-1 justify-self-start">
        {!railShown && <RailToggle className="glass-veil size-10" />}
        <WorldIsland />
      </div>

      {/* Center island: modes */}
      <TabsList
        ref={listRef}
        aria-label={t("shell.tabs.label")}
        className="glass-veil relative h-10 gap-0.5 rounded-full p-1 group-data-horizontal/tabs:h-10"
      >
        {pill && (
          <span
            aria-hidden
            className="absolute top-1 bottom-1 rounded-full bg-secondary shadow-(--bz-shadow-veil) transition-[left,width] duration-(--bz-duration-base) ease-atlas-spring"
            style={{ left: pill.left, width: pill.width }}
          />
        )}
        {TABS.map(({ value, icon: Icon, label }) => {
          const active = value === activeTab;
          const trigger = (
            <TabsTrigger
              onClick={() => onTabClick(value)}
              key={value}
              value={value}
              data-tab={value}
              aria-label={t(label)}
              className="relative z-10 h-8 flex-none rounded-full px-3 text-muted-foreground data-[state=active]:border-transparent data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
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
        className="glass-veil flex h-10 items-center gap-0.5 justify-self-end rounded-full px-1"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-full"
              aria-label={t("shell.actions.search")}
              aria-keyshortcuts="Control+K"
              onClick={onSearch}
            >
              <Search />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {t("shell.actions.search")}{" "}
            <kbd className="ml-1 font-sans opacity-70">{t("shell.actions.searchKeys")}</kbd>
          </TooltipContent>
        </Tooltip>
        {world && <RadioButton worldId={world.id} />}

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
