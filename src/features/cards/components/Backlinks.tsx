import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { LayoutGrid, Map as MapIcon, Network, Share2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { typeColor, typeIcon, useCardTypes } from "@/features/card-types";
import { type BacklinkVia, commands, type DocumentKind } from "@/lib/bindings";
import { useDocumentLink } from "@/lib/documentLinks";
import { unwrap } from "@/lib/ipc";
import { documentKeys } from "../hooks/keys";

export function useBacklinks(cardId: string) {
  return useQuery({
    // Under the documents: any change to cards or links refreshes it.
    queryKey: [...documentKeys.all(), "backlinks", cardId],
    queryFn: () => unwrap(commands.cardBacklinks(cardId)),
  });
}

/** The icon of a document that is not a card (a card shows its type's). */
const KIND_ICONS: Partial<Record<DocumentKind, typeof Network>> = {
  map: MapIcon,
  graph: Share2,
  tree: Network,
  canvas: LayoutGrid,
};

/**
 * "Cited in" at the bottom of a card: the documents that cite it, and how.
 * Those that cannot be opened where the card is shown are left out.
 */
export function Backlinks({ cardId }: { cardId: string }) {
  const { t } = useTranslation();
  const linkOf = useDocumentLink();
  const backlinks = useBacklinks(cardId);
  const types = useCardTypes();

  const describe = (via: BacklinkVia) =>
    via.kind === "property" && via.propertyLabel
      ? via.propertyLabel
      : t(`backlinks.via.${via.kind}`);

  // Only the documents that can be opened here (in the wiki: visible pages).
  const shown = backlinks.data?.flatMap((backlink) => {
    const link = linkOf(backlink.sourceKind, backlink.sourceId);
    return link ? [{ backlink, link }] : [];
  });

  return (
    <section
      aria-label={t("backlinks.title")}
      className="flex flex-col gap-2 border-t border-border pt-4"
    >
      <h2 className="text-sm font-bold text-muted-foreground">{t("backlinks.title")}</h2>
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
                  <span className="truncate">{backlink.sourceTitle}</span>
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
