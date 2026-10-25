import { Link } from "@tanstack/react-router";
import {
  ChartGantt,
  LayoutGrid,
  type LucideIcon,
  Map as MapIcon,
  Network,
  Plus,
  Share2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { typeColor, typeIcon, useCardTypes } from "@/features/card-types";
import { CreateCardMenu, useRecentDocuments } from "@/features/cards";
import { AssetImage } from "@/features/media";
import type { CardType, DocumentKind, RecentDocument } from "@/lib/bindings";
import { documentRoute } from "@/lib/documentRoute";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

/** How many recent documents Home shows. */
const RECENT_COUNT = 8;

/** The emblem of the documents that are not cards. */
const KIND_ICONS: Record<Exclude<DocumentKind, "card">, LucideIcon> = {
  map: MapIcon,
  graph: Share2,
  tree: Network,
  canvas: LayoutGrid,
  timeline: ChartGantt,
};

/** A card's type colour and icon, or the emblem of the document's kind. */
function documentLook(document: RecentDocument, types: CardType[]) {
  if (document.kind !== "card")
    return { Icon: KIND_ICONS[document.kind], color: "var(--bz-accent)" };
  const type = types.find((candidate) => candidate.id === document.typeId);
  return { Icon: typeIcon(type?.icon ?? "shapes"), color: typeColor(type?.color ?? "slate") };
}

function DocumentIcon({
  document,
  types,
  className = "size-4",
}: {
  document: RecentDocument;
  types: CardType[];
  className?: string;
}) {
  const { Icon, color } = documentLook(document, types);
  return <Icon aria-hidden className={cn("shrink-0", className)} style={{ color }} />;
}

/**
 * "Pick up where you left off" (the last opened document, then "or try
 * something new" with a card creation button) and the recent documents.
 */
export function RecentDocuments({ worldId }: { worldId: string }) {
  const { t, i18n } = useTranslation();
  const recent = useRecentDocuments(RECENT_COUNT);
  const types = useCardTypes();
  const documents = recent.data ?? [];
  const all = types.data ?? [];
  const last = documents[0];

  const newCard = (
    <CreateCardMenu align="start">
      <Button variant="secondary" size="sm" className="rounded-full">
        <Plus />
        {t("home.newCard")}
      </Button>
    </CreateCardMenu>
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {last ? (
          <>
            {t("home.resume")}
            <Button asChild variant="secondary" size="sm" className="rounded-full">
              <Link
                {...documentRoute(worldId, last.kind, last.id)}
                aria-label={t("home.resumeCard", { name: last.title })}
              >
                <DocumentIcon document={last} types={all} />
                {last.title}
              </Link>
            </Button>
            {t("home.orNew")}
            {newCard}
          </>
        ) : (
          <>
            {t("home.firstCard")}
            {newCard}
          </>
        )}
      </p>

      {recent.data && documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("home.recentNone")}</p>
      ) : (
        <ul
          aria-label={t("home.recentLabel")}
          className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3"
        >
          {documents.map((document) => (
            <li key={document.id}>
              <Link
                {...documentRoute(worldId, document.kind, document.id)}
                className="group flex flex-col overflow-hidden rounded-lg border border-border bg-(--bz-field) outline-none transition-[translate,box-shadow,border-color] duration-(--bz-duration-base) ease-atlas hover:-translate-y-0.5 hover:border-border-strong hover:shadow-(--bz-shadow-panel) focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
              >
                <div className="aspect-[4/3] overflow-hidden bg-muted">
                  {document.imageAssetId ? (
                    <AssetImage
                      assetId={document.imageAssetId}
                      alt=""
                      className="size-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    // No image: its emblem, large, on a paper tinted with its colour.
                    <div
                      className="flex size-full items-center justify-center"
                      style={{
                        background: `radial-gradient(circle at 50% 45%, color-mix(in oklab, ${documentLook(document, all).color} 16%, transparent), transparent 70%)`,
                      }}
                    >
                      <DocumentIcon
                        document={document}
                        types={all}
                        className="size-10 opacity-80 transition-transform duration-(--bz-duration-slow) ease-atlas group-hover:scale-110 motion-reduce:transition-none"
                      />
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-0.5 p-2">
                  <span className="truncate font-heading font-semibold">{document.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatRelative(document.openedAt, i18n.language)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
