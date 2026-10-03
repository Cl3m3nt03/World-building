import { Link, useCanGoBack, useParams, useRouter } from "@tanstack/react-router";
import { ArrowLeft, ChevronDown, ExternalLink, Map as MapIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCardTypes } from "@/features/card-types";
import { typeLabel } from "@/features/cards";
import { useCurrentWorld } from "@/features/world";
import type { WikiPage } from "@/lib/bindings";
import { documentRoute } from "@/lib/documentRoute";
import { cn } from "@/lib/utils";
import { useWikiPages, useWikiSettings } from "../hooks/useWiki";
import { pageRoute } from "../links";
import { ExportDialog } from "./ExportDialog";
import { PageIcon } from "./PageIcon";
import { WIKI_BUTTON, WIKI_FOCUS } from "./styles";
import { WikiSearch } from "./WikiSearch";

/**
 * The wiki's bar, above its pages: back, the wiki's name (its home page),
 * the pages by type, the search, « Exporter le wiki », and, on a page, the
 * same document in World.
 */
export function WikiBar() {
  const { t } = useTranslation();
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const params = useParams({ strict: false });
  const worldId = params.worldId ?? "";
  const settings = useWikiSettings();
  const { data: world } = useCurrentWorld();
  const title = settings.data?.title || world?.name || "";
  // The document of the page shown, if any.
  const current = params.cardId
    ? documentRoute(worldId, "card", params.cardId)
    : params.mapId
      ? documentRoute(worldId, "map", params.mapId)
      : null;

  return (
    <nav
      aria-label={t("wiki.bar.label")}
      className="flex shrink-0 items-center gap-2 border-b border-wiki-text/10 px-4 py-2"
    >
      <button
        type="button"
        className={WIKI_BUTTON}
        disabled={!canGoBack}
        aria-label={t("wiki.bar.back")}
        onClick={() => router.history.back()}
      >
        <ArrowLeft aria-hidden />
      </button>
      <Link
        to="/world/$worldId/wiki"
        params={{ worldId }}
        activeOptions={{ exact: true }}
        className={cn(
          "truncate rounded font-wiki-heading text-base font-bold text-wiki-accent",
          WIKI_FOCUS,
        )}
      >
        {title}
      </Link>
      <PagesMenu />
      <div className="ml-auto flex items-center gap-2">
        <WikiSearch variant="bar" placeholder={t("wiki.bar.search")} />
        <ExportDialog />
        {current && (
          <Link {...current} className={WIKI_BUTTON}>
            <ExternalLink aria-hidden />
            {t("wiki.bar.openInWorld")}
          </Link>
        )}
      </div>
    </nav>
  );
}

/** « Pages »: every page of the wiki, by card type, then the maps. */
function PagesMenu() {
  const { t } = useTranslation();
  const { worldId } = useParams({ from: "/world/$worldId" });
  const pages = useWikiPages();
  const types = useCardTypes();
  const all = types.data ?? [];
  const list = pages.data ?? [];
  const byTitle = (a: WikiPage, b: WikiPage) => a.title.localeCompare(b.title);
  // Types in their order; a page whose type is unknown goes with "no type".
  const groups = [
    ...all.map((type) => ({
      key: type.id,
      label: typeLabel(type, all),
      icon: null,
      pages: list.filter((page) => page.kind === "card" && page.typeId === type.id),
    })),
    {
      key: "none",
      label: t("cards.noType"),
      icon: null,
      pages: list.filter(
        (page) => page.kind === "card" && !all.some((type) => type.id === page.typeId),
      ),
    },
    {
      key: "maps",
      label: t("wiki.bar.maps"),
      icon: <MapIcon aria-hidden />,
      pages: list.filter((page) => page.kind === "map"),
    },
  ].filter((group) => group.pages.length > 0);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={WIKI_BUTTON} disabled={list.length === 0}>
          {t("wiki.bar.pages")}
          <ChevronDown aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-96 w-64 overflow-y-auto">
        {groups.map((group) => (
          <DropdownMenuGroup key={group.key}>
            <DropdownMenuLabel className="flex items-center gap-1.5 [&_svg]:size-3.5">
              {group.icon}
              {group.label}
            </DropdownMenuLabel>
            {[...group.pages].sort(byTitle).map((page) => (
              <DropdownMenuItem key={page.id} asChild>
                <Link {...pageRoute(worldId, page)}>
                  <PageIcon page={page} />
                  <span className="truncate">{page.title}</span>
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
