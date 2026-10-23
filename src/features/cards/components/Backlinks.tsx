import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { ChartGantt, Feather, LayoutGrid, Map as MapIcon, Network, Share2 } from "lucide-react";
import { useContext } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { typeColor, typeIcon, useCardTypes } from "@/features/card-types";
import { type Backlink, type BacklinkSource, type BacklinkVia, commands } from "@/lib/bindings";
import { ChapterLinksContext, chapterRoute, useDocumentLink } from "@/lib/documentLinks";
import { timelineCardRoute } from "@/lib/documentRoute";
import { unwrap } from "@/lib/ipc";
import { documentKeys } from "../hooks/keys";

export function useBacklinks(cardId: string) {
  return useQuery({
    // Under the documents: any change to cards or links refreshes it.
    queryKey: [...documentKeys.all(), "backlinks", cardId],
    queryFn: () => unwrap(commands.cardBacklinks(cardId)),
  });
}

/** The icon of a source that is not a card (a card shows its type's). */
const KIND_ICONS: Partial<Record<BacklinkSource, typeof Network>> = {
  map: MapIcon,
  graph: Share2,
  tree: Network,
  canvas: LayoutGrid,
  timeline: ChartGantt,
  chapter: Feather,
};

/**
 * "Cited in" at the bottom of a card: the documents that cite it, and how.
 * Those that cannot be opened where the card is shown are left out.
 */
export function Backlinks({ cardId }: { cardId: string }) {
  const { t } = useTranslation();
  const linkOf = useDocumentLink();
  const showChapters = useContext(ChapterLinksContext);
  const { worldId } = useParams({ from: "/world/$worldId" });
  const backlinks = useBacklinks(cardId);
  const types = useCardTypes();

  const describe = (via: BacklinkVia) =>
    via.kind === "property" && via.propertyLabel
      ? via.propertyLabel
      : t(`backlinks.via.${via.kind}`);

  // Only what can be opened here (in the wiki: visible pages, no chapters).
  const linkFor = (backlink: Backlink) => {
    if (backlink.sourceKind === "timeline") {
      // In World, the timeline opens centred on this card's item.
      const link = linkOf("timeline", backlink.sourceId);
      return link?.to === "/world/$worldId/world/timeline/$timelineId"
        ? timelineCardRoute(worldId, backlink.sourceId, cardId)
        : link;
    }
    if (backlink.sourceKind !== "chapter") return linkOf(backlink.sourceKind, backlink.sourceId);
    return showChapters && backlink.storyId
      ? chapterRoute(worldId, backlink.storyId, backlink.sourceId)
      : null;
  };
  const shown = backlinks.data?.flatMap((backlink) => {
    const link = linkFor(backlink);
    return link ? [{ backlink, link }] : [];
  });
  const title = (backlink: Backlink) =>
    backlink.sourceKind === "chapter"
      ? t("backlinks.chapter", { chapter: backlink.sourceTitle, story: backlink.storyTitle ?? "" })
      : backlink.sourceTitle;

  return (
    <section
      aria-label={t("backlinks.title")}
      className="flex flex-col gap-2 border-t border-border pt-4"
    >
      <h2 className="rubric">{t("backlinks.title")}</h2>
      {backlinks.error && <AppErrorMessage error={backlinks.error} />}
      {shown?.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("backlinks.none")}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {shown?.map(({ backlink, link }) => {
            const type = types.data?.find((candidate) => candidate.id === backlink.sourceTypeId);
            const KindIcon = KIND_ICONS[backlink.sourceKind];
            const Icon = KindIcon ?? typeIcon(type?.icon ?? "shapes");
            return (
              <li key={backlink.sourceId}>
                <Link
                  {...link}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <Icon
                    aria-hidden
                    className="size-4 shrink-0"
                    style={KindIcon ? undefined : { color: typeColor(type?.color ?? "slate") }}
                  />
                  <span className="truncate">{title(backlink)}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {backlink.via.map(describe).join(" · ")}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
