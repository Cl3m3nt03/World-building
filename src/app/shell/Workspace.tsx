import { Link, useParams } from "@tanstack/react-router";
import {
  Images,
  LayoutGrid,
  type LucideIcon,
  Map as MapIcon,
  Share2,
  SquareUser,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { SIDEBAR_WIDTH, useUiStore } from "@/app/stores/ui";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { TranslationKey } from "@/i18n";

/** Document kinds and the milestone that brings each one (docs/roadmap). */
const CREATE_TILES: { icon: LucideIcon; label: TranslationKey; milestone: string }[] = [
  { icon: SquareUser, label: "workspace.create.card", milestone: "M2" },
  { icon: MapIcon, label: "workspace.create.map", milestone: "M4" },
  { icon: LayoutGrid, label: "workspace.create.canvas", milestone: "M7" },
  { icon: Share2, label: "workspace.create.graph", milestone: "M5" },
];

/**
 * Empty-workspace prompt: "Start with…" and one tile per document kind.
 * Tiles stay visible but are marked unavailable until their module exists,
 * so nothing clickable silently does nothing.
 */
function StartWith() {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      <p className="text-sm text-muted-foreground">{t("workspace.startWith")}</p>
      <div className="flex gap-3">
        {CREATE_TILES.map(({ icon: Icon, label, milestone }) => (
          <div key={label} className="flex flex-col items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  aria-label={t(label)}
                  aria-disabled
                  aria-describedby={`${label}-soon`}
                  onClick={(event) => event.preventDefault()}
                  className="glass size-12 cursor-not-allowed rounded-lg opacity-60 [&_svg:not([class*='size-'])]:size-5"
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

/** World tab: resizable sidebar + central workspace. */
export function WorldWorkspace() {
  const { t } = useTranslation();
  const sidebarWidth = useUiStore((state) => state.sidebarWidth);
  const setSidebarWidth = useUiStore((state) => state.setSidebarWidth);
  return (
    <ResizablePanelGroup orientation="horizontal" className="gap-1">
      <ResizablePanel
        defaultSize={sidebarWidth}
        minSize={SIDEBAR_WIDTH.min}
        maxSize={SIDEBAR_WIDTH.max}
        onResize={(size) => setSidebarWidth(size.inPixels)}
      >
        <aside aria-label={t("sidebar.label")} className="glass flex h-full flex-col rounded-lg">
          <ScrollArea className="min-h-0 flex-1">
            <p className="p-4 text-center text-xs text-muted-foreground">{t("sidebar.empty")}</p>
          </ScrollArea>
        </aside>
      </ResizablePanel>
      <ResizableHandle
        aria-label={t("sidebar.resize")}
        className="w-1 rounded-full bg-transparent hover:bg-border-strong focus-visible:bg-primary"
      />
      <ResizablePanel>
        <main className="h-full">
          <StartWith />
        </main>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

export function HomePlaceholder() {
  const { t } = useTranslation();
  const { worldId } = useParams({ from: "/world/$worldId" });
  return (
    <main className="mx-auto flex h-full w-full max-w-5xl flex-col gap-2 px-8 pt-10">
      <h1 className="text-4xl font-bold">{t("home.welcome")}</h1>
      <p className="text-sm text-muted-foreground">{t("placeholder.comingSoon")}</p>
      <div className="mt-6">
        <Button asChild variant="secondary" className="rounded-full">
          <Link to="/world/$worldId/media" params={{ worldId }}>
            <Images />
            {t("media.title")}
          </Link>
        </Button>
      </div>
    </main>
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
