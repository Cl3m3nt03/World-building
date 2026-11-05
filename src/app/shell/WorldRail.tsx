import { LayoutGrid, PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useUiStore } from "@/app/stores/ui";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SettingsButton, useSettings } from "@/features/settings";
import { thumbnailUrl, useCloseWorld, useCurrentWorld, useOpenWorld } from "@/features/world";
import type { RecentWorld } from "@/lib/bindings";
import { cn } from "@/lib/utils";
import { Atlas } from "./Atlas";
import { slideLayout } from "./useSlideCollapse";

/** Keeps the leaving rail where it is, out of the layout: the page takes its room at once. */
function pinRail(rail: HTMLElement) {
  const { position, top, bottom, left } = rail.style;
  Object.assign(rail.style, { position: "absolute", top: "0", bottom: "0", left: "0" });
  return () => Object.assign(rail.style, { position, top, bottom, left });
}

/**
 * Shows or folds the rail (motion plan, batch D): the page takes its new
 * width at once and its panels slide to it, the rail sliding in or out.
 */
/**
 * The focus, lost with the button that was pressed (or left in the rail that
 * leaves), goes to the button that undoes the gesture.
 */
function keepFocus() {
  requestAnimationFrame(() => {
    const active = document.activeElement;
    if (active && active !== document.body && !active.closest("[inert]")) return;
    const toggle = [
      ...document.querySelectorAll<HTMLElement>('button[aria-controls="world-rail"]'),
    ].find((button) => !button.closest("[inert]"));
    toggle?.focus({ preventScroll: true });
  });
}

function toggleRail(shown: boolean) {
  const { setWorldRail, setWorldRailLeaving } = useUiStore.getState();
  keepFocus();
  const root = document.querySelector<HTMLElement>("[data-slide-root]");
  const rail = () => document.getElementById("world-rail");
  const change = () => {
    setWorldRailLeaving(shown);
    setWorldRail(!shown);
  };
  if (!root) {
    change();
    setWorldRailLeaving(false);
    return;
  }
  const current = rail();
  slideLayout({
    root,
    change,
    leaving: shown && current ? { element: current, pin: pinRail } : undefined,
    entering: shown ? undefined : rail,
    distance: -(current?.getBoundingClientRect().right || 64),
    unclip: "[data-panel] > *, [data-group]",
    done: () => setWorldRailLeaving(false),
  });
}

/** The rail's button that shows or folds it (in the rail, or in the top bar when folded). */
export function RailToggle({ className }: { className?: string }) {
  const { t } = useTranslation();
  const shown = useUiStore((state) => state.worldRail);
  const label = shown ? t("rail.fold") : t("rail.show");
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          aria-expanded={shown}
          aria-controls="world-rail"
          className={cn("rounded-full", className)}
          onClick={() => toggleRail(shown)}
        >
          {shown ? <PanelLeftClose /> : <PanelLeftOpen />}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function RailItem({
  label,
  current = false,
  onClick,
  disabled,
  children,
}: {
  label: string;
  current?: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          data-rail-item
          aria-label={label}
          aria-current={current ? "page" : undefined}
          disabled={disabled}
          onClick={onClick}
          className="relative flex size-10 shrink-0 items-center justify-center rounded-full outline-none transition-[box-shadow,scale] duration-(--bz-duration-fast) ease-atlas hover:scale-105 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60 aria-[current=page]:shadow-[0_0_0_2px_var(--bz-accent)] motion-reduce:transition-none"
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="font-heading text-sm">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

/** A world's round emblem: its cover, or its own atlas. */
function WorldEmblem({ world }: { world: RecentWorld }) {
  return world.thumbnail ? (
    <img src={thumbnailUrl(world)} alt="" className="size-9 rounded-full object-cover" />
  ) : (
    <span
      aria-hidden
      className="relative size-9 overflow-hidden rounded-full"
      style={
        {
          background: "var(--bz-backdrop-gradient)",
          // A small map needs a darker ink to read.
          "--bz-atlas-ink": "var(--bz-atlas-ink-strong)",
        } as CSSProperties
      }
    >
      <Atlas seed={world.id ?? world.path} still />
    </span>
  );
}

/** Up and down arrows move between the rail's items; Home and End go to the ends. */
function moveInRail(event: KeyboardEvent<HTMLElement>) {
  const items = [...event.currentTarget.querySelectorAll<HTMLElement>("[data-rail-item]")];
  const current = items.indexOf(document.activeElement as HTMLElement);
  if (current < 0) return;
  const next =
    event.key === "ArrowDown"
      ? items[current + 1]
      : event.key === "ArrowUp"
        ? items[current - 1]
        : event.key === "Home"
          ? items[0]
          : event.key === "End"
            ? items[items.length - 1]
            : undefined;
  if (!next) return;
  event.preventDefault();
  next.focus();
}

/**
 * The world rail (V2-2+.1, after vvd): a thin column on the left with the
 * world list, one round emblem per recent world (the open one ringed in
 * gold), « + » for a new world, and the app settings at the bottom. One click
 * switches world from anywhere. Folded, it takes no room.
 */
export function WorldRail() {
  const { t } = useTranslation();
  const shown = useUiStore((state) => state.worldRail);
  const leaving = useUiStore((state) => state.worldRailLeaving);
  const openCreateWorld = useUiStore((state) => state.setCreateWorldOpen);
  const settings = useSettings();
  const { data: world } = useCurrentWorld();
  const openWorld = useOpenWorld();
  const closeWorld = useCloseWorld();
  if (!shown && !leaving) return null;
  const worlds = settings.data?.recentWorlds ?? [];

  return (
    <nav
      id="world-rail"
      aria-label={t("rail.label")}
      onKeyDown={moveInRail}
      className="glass-veil atlas-settle relative z-20 m-2 mr-0 flex w-14 shrink-0 flex-col items-center gap-2 rounded-xl py-2"
    >
      <RailToggle />
      <RailItem
        label={t("rail.worlds")}
        current={!world}
        onClick={() => {
          if (world) closeWorld.mutate();
        }}
      >
        <LayoutGrid className="size-5" />
      </RailItem>
      <span aria-hidden className="h-px w-8 shrink-0 bg-border" />
      <ul className="flex min-h-0 flex-col items-center gap-2 overflow-y-auto px-1 py-0.5">
        {worlds.map((recent) => (
          <li key={recent.path}>
            <RailItem
              label={recent.name}
              current={recent.path === world?.path}
              disabled={openWorld.isPending}
              onClick={() => {
                if (recent.path !== world?.path) openWorld.mutate(recent.path);
              }}
            >
              <WorldEmblem world={recent} />
            </RailItem>
          </li>
        ))}
      </ul>
      <RailItem label={t("worlds.create")} onClick={() => openCreateWorld(true)}>
        <Plus className="size-5 text-muted-foreground" />
      </RailItem>
      <div className="mt-auto">
        <SettingsButton />
      </div>
    </nav>
  );
}
