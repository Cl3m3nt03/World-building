import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { typeColor, typeIcon, useCardTypes } from "@/features/card-types";
import { CreateCardMenu, useRecentDocuments } from "@/features/cards";
import { AssetImage } from "@/features/media";
import type { CardType, RecentDocument } from "@/lib/bindings";
import { formatRelative } from "@/lib/format";

/** How many recent documents Home shows. */
const RECENT_COUNT = 8;

function DocumentIcon({ document, types }: { document: RecentDocument; types: CardType[] }) {
  const type = types.find((candidate) => candidate.id === document.typeId);
  const Icon = typeIcon(type?.icon ?? "shapes");
  return (
    <Icon
      aria-hidden
      className="size-4 shrink-0"
      style={{ color: typeColor(type?.color ?? "slate") }}
    />
  );
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
                to="/world/$worldId/world/card/$cardId"
                params={{ worldId, cardId: last.id }}
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
                to="/world/$worldId/world/card/$cardId"
                params={{ worldId, cardId: document.id }}
                className="group flex flex-col overflow-hidden rounded-lg border border-border outline-none hover:border-border-strong focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <div className="aspect-[4/3] overflow-hidden bg-muted">
                  {document.imageAssetId ? (
                    <AssetImage
                      assetId={document.imageAssetId}
                      alt=""
                      className="size-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div
                      className="flex size-full items-center justify-center"
                      style={{ background: "var(--bz-backdrop-gradient)" }}
                    >
                      <DocumentIcon document={document} types={all} />
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-0.5 p-2">
                  <span className="truncate text-sm">{document.title}</span>
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
