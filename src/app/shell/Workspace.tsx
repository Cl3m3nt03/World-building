import { Outlet } from "@tanstack/react-router";
import {
  LayoutGrid,
  type LucideIcon,
  Map as MapIcon,
  PanelLeftOpen,
  Share2,
  SquareUser,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { PanelImperativeHandle } from "react-resizable-panels";
import { SIDEBAR_WIDTH } from "@/app/stores/ui";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CreateCardMenu } from "@/features/cards";
import { useSidebarState, WorldSidebar } from "@/features/sidebar";
import type { TranslationKey } from "@/i18n";

/** Document kinds not available yet, and the milestone that brings each one (docs/roadmap). */
const SOON_TILES: { icon: LucideIcon; label: TranslationKey; milestone: string }[] = [
  { icon: MapIcon, label: "workspace.create.map", milestone: "M4" },
  { icon: LayoutGrid, label: "workspace.create.canvas", milestone: "M7" },
  { icon: Share2, label: "workspace.create.graph", milestone: "M5" },
];

const TILE_CLASS = "glass size-12 rounded-lg [&_svg:not([class*='size-'])]:size-5";

/**
 * Empty-workspace prompt: "Start with…" and one tile per document kind.
 * A card is created from its type menu; kinds whose module does not exist
 * yet stay visible but are marked unavailable, so nothing clickable
 * silently does nothing.
 */
export function StartWith() {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      <p className="text-sm text-muted-foreground">{t("workspace.startWith")}</p>
      <div className="flex gap-3">
        <div className="flex flex-col items-center gap-1.5">
          <CreateCardMenu>
            <Button
              variant="secondary"
              aria-label={t("workspace.create.card")}
              className={TILE_CLASS}
            >
              <SquareUser />
            </Button>
          </CreateCardMenu>
          <span className="text-xs text-muted-foreground">{t("workspace.create.card")}</span>
        </div>
        {SOON_TILES.map(({ icon: Icon, label, milestone }) => (
          <div key={label} className="flex flex-col items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  aria-label={t(label)}
                  aria-disabled
                  aria-describedby={`${label}-soon`}
                  onClick={(event) => event.preventDefault()}
                  className={`${TILE_CLASS} cursor-not-allowed opacity-60`}
                >
                  <Icon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("placeholder.comingIn", { milestone })}</TooltipContent>
            </Tooltip>
            <span className="text-xs text-muted-foreground">{t(label)}</span>
            <span id={`${label}-soon`} className="sr-only">
              {t("placeholder.comingIn", { milestone })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * World tab: resizable sidebar + central workspace. The sidebar's width and
 * collapse are kept per world (ADR 0005); collapsed, a button at the top
 * left of the workspace brings it back. The handle takes the focus and is
 * moved with the arrow keys.
 */
export function WorldWorkspace() {
  const { t } = useTranslation();
  const sidebar = useSidebarState();
  const panel = useRef<PanelImperativeHandle>(null);
  const expandButton = useRef<HTMLButtonElement>(null);
  const group = useRef<HTMLDivElement>(null);
  // Collapsing or expanding with a button moves the focus to what is now
  // there (the button that undoes it, or the sidebar's search field).
  const moveFocus = useRef(false);
  const state = sidebar.state;
  const collapsed = state?.collapsed ?? false;
  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    if (collapsed) expandButton.current?.focus();
    else group.current?.querySelector<HTMLElement>("aside [role=combobox]")?.focus();
  }, [collapsed]);
  if (sidebar.error) return <AppErrorMessage error={sidebar.error} />;
  if (!state) return null;
  const width = state.width ?? SIDEBAR_WIDTH.default;

  return (
    <ResizablePanelGroup elementRef={group} orientation="horizontal" className="gap-1">
      <ResizablePanel
        panelRef={panel}
        defaultSize={collapsed ? 0 : width}
        minSize={SIDEBAR_WIDTH.min}
        maxSize={SIDEBAR_WIDTH.max}
        collapsible
        collapsedSize={0}
        onResize={(size) => {
          const nowCollapsed = size.inPixels < 1;
          const nowWidth = Math.round(size.inPixels);
          if (nowCollapsed !== collapsed || (!nowCollapsed && nowWidth !== width)) {
            sidebar.update(
              nowCollapsed ? { collapsed: true } : { collapsed: false, width: nowWidth },
            );
          }
        }}
      >
        {!collapsed && (
          <WorldSidebar
            onCollapse={() => {
              moveFocus.current = true;
              panel.current?.collapse();
            }}
          />
        )}
      </ResizablePanel>
      <ResizableHandle
        aria-label={t("sidebar.resize")}
        className="w-1 rounded-full bg-transparent hover:bg-border-strong focus-visible:bg-primary"
      />
      <ResizablePanel>
        <main className="relative h-full">
          {collapsed && (
            <Button
              ref={expandButton}
              variant="secondary"
              size="icon-sm"
              aria-label={t("sidebar.expand")}
              title={t("sidebar.expand")}
              onClick={() => {
                moveFocus.current = true;
                panel.current?.expand();
              }}
              className="glass absolute top-2 left-2 z-10"
            >
              <PanelLeftOpen />
            </Button>
          )}
          <Outlet />
        </main>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

type ComingSoonProps = {
  title: TranslationKey;
  /** What the module will do, so the empty tab explains itself. */
  description: TranslationKey;
  milestone: string;
};

export function ComingSoon({ title, description, milestone }: ComingSoonProps) {
  const { t } = useTranslation();
  return (
    <main className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
      <h1 className="text-2xl font-bold">{t(title)}</h1>
      <p className="max-w-md text-sm text-muted-foreground">{t(description)}</p>
      <p className="rounded-full border px-3 py-1 text-xs text-muted-foreground">
        {t("placeholder.comingIn", { milestone })}
      </p>
    </main>
  );
}
