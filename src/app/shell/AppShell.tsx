import { useState } from "react";
import { useTheme, useTransparency } from "@/app/theme";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Backdrop } from "./Backdrop";
import { type ShellTab, TopBar } from "./TopBar";
import { ComingSoon, HomePlaceholder, WorldWorkspace } from "./Workspace";

const SHELL_TABS: readonly string[] = ["home", "world", "wiki", "quill"] satisfies ShellTab[];

function isShellTab(value: string): value is ShellTab {
  return SHELL_TABS.includes(value);
}

/**
 * App shell (ADR 0003): blurred backdrop, three-island top bar, and the tab
 * content below. Tabs are local state until routing lands in 0.7.
 */
export function AppShell() {
  const [tab, setTab] = useState<ShellTab>("world");
  const theme = useTheme();
  const transparency = useTransparency();

  return (
    <TooltipProvider delayDuration={300}>
      <Backdrop />
      <Tabs
        value={tab}
        onValueChange={(value) => {
          if (isShellTab(value)) setTab(value);
        }}
        className="relative flex h-screen w-screen flex-col gap-2 p-2"
      >
        <TopBar
          activeTab={tab}
          theme={theme.preference}
          onThemeChange={theme.setPreference}
          transparency={transparency.transparency}
          onTransparencyChange={transparency.setTransparency}
        />
        <TabsContent value="home" className="min-h-0 flex-1">
          <HomePlaceholder />
        </TabsContent>
        <TabsContent value="world" className="min-h-0 flex-1">
          <WorldWorkspace />
        </TabsContent>
        <TabsContent value="wiki" className="min-h-0 flex-1">
          <ComingSoon title="shell.tabs.wiki" />
        </TabsContent>
        <TabsContent value="quill" className="min-h-0 flex-1">
          <ComingSoon title="shell.tabs.quill" />
        </TabsContent>
      </Tabs>
    </TooltipProvider>
  );
}
