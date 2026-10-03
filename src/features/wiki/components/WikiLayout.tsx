import { Outlet } from "@tanstack/react-router";
import { DocumentLinkContext } from "@/lib/documentLinks";
import { useWikiSettings } from "../hooks/useWiki";
import { useWikiLinks } from "../links";
import { themeScheme, themeStyle } from "../theme";
import { WikiBar } from "./WikiBar";

/**
 * The Wiki tab: its pages under the wiki's own theme. The theme's variables
 * sit on this root only; the app around keeps its own. Links to documents
 * lead to their wiki pages, or are plain text. The wiki's bar sits above.
 */
export function WikiLayout() {
  const settings = useWikiSettings();
  const { resolve } = useWikiLinks();
  return (
    <div
      data-wiki
      data-wiki-scheme={settings.data ? themeScheme(settings.data.theme) : undefined}
      style={settings.data ? themeStyle(settings.data.theme) : undefined}
      className="flex h-full flex-col overflow-hidden rounded-lg bg-wiki-background font-wiki-body text-wiki-text"
    >
      <DocumentLinkContext.Provider value={resolve}>
        <WikiBar />
        <div className="min-h-0 flex-1">
          <Outlet />
        </div>
      </DocumentLinkContext.Provider>
    </div>
  );
}
