import { LayoutGrid, type LucideIcon, Map as MapIcon, Share2, SquareUser } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { type TranslationKey, t } from "@/i18n";

const CREATE_TILES: { icon: LucideIcon; label: TranslationKey }[] = [
  { icon: SquareUser, label: "workspace.create.card" },
  { icon: MapIcon, label: "workspace.create.map" },
  { icon: LayoutGrid, label: "workspace.create.canvas" },
  { icon: Share2, label: "workspace.create.graph" },
];

/** Empty-workspace prompt: "Start with…" and one tile per document kind. */
function StartWith() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      <p className="text-sm text-muted-foreground">{t("workspace.startWith")}</p>
      <div className="flex gap-3">
        {CREATE_TILES.map(({ icon: Icon, label }) => (
          <div key={label} className="flex flex-col items-center gap-1.5">
            <Button
              variant="secondary"
              aria-label={t(label)}
              className="glass size-12 rounded-lg [&_svg:not([class*='size-'])]:size-5"
            >
              <Icon />
            </Button>
            <span className="text-xs text-muted-foreground">{t(label)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** World tab: resizable sidebar + central workspace. */
export function WorldWorkspace() {
  return (
    <ResizablePanelGroup orientation="horizontal" className="gap-1">
      <ResizablePanel defaultSize={280} minSize={200} maxSize={480}>
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
  return (
    <main className="mx-auto flex h-full w-full max-w-5xl flex-col gap-2 px-8 pt-10">
      <h1 className="text-4xl font-bold">{t("home.welcome")}</h1>
      <p className="text-sm text-muted-foreground">{t("placeholder.comingSoon")}</p>
    </main>
  );
}

export function ComingSoon({ title }: { title: TranslationKey }) {
  return (
    <main className="flex h-full flex-col items-center justify-center gap-2">
      <h1 className="text-2xl font-bold">{t(title)}</h1>
      <p className="text-sm text-muted-foreground">{t("placeholder.comingSoon")}</p>
    </main>
  );
}
