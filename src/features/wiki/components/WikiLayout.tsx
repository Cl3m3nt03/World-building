import { Outlet } from "@tanstack/react-router";
import { useWikiSettings } from "../hooks/useWiki";
import { themeStyle } from "../theme";

/**
 * The Wiki tab: its pages under the wiki's own theme. The theme's variables
 * sit on this root only; the app around keeps its own.
 */
export function WikiLayout() {
  const settings = useWikiSettings();
  return (
    <div
      data-wiki
      style={settings.data ? themeStyle(settings.data.theme) : undefined}
      className="h-full overflow-hidden rounded-lg bg-wiki-background font-wiki-body text-wiki-text"
    >
      <Outlet />
    </div>
  );
}
