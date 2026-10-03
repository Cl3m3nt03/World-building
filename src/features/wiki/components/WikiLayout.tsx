import { Outlet } from "@tanstack/react-router";
import { DocumentLinkContext } from "@/lib/documentLinks";
import { useWikiSettings } from "../hooks/useWiki";
import { useWikiLinks } from "../links";
import { themeScheme, themeStyle } from "../theme";

/**
 * The Wiki tab: its pages under the wiki's own theme. The theme's variables
 * sit on this root only; the app around keeps its own. Links to documents
 * lead to their wiki pages, or are plain text.
 */
export function WikiLayout() {
  const settings = useWikiSettings();
  const { resolve } = useWikiLinks();
  return (
    <div
      data-wiki
      data-wiki-scheme={settings.data ? themeScheme(settings.data.theme) : undefined}
      style={settings.data ? themeStyle(settings.data.theme) : undefined}
      className="h-full overflow-hidden rounded-lg bg-wiki-background font-wiki-body text-wiki-text"
    >
      <DocumentLinkContext.Provider value={resolve}>
        <Outlet />
      </DocumentLinkContext.Provider>
    </div>
  );
}
