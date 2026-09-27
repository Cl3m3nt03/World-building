import { Link } from "@tanstack/react-router";
import { Images, type LucideIcon, Palette, Settings2, Shapes, Share2 } from "lucide-react";
import type { ReactNode } from "react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { useUiStore } from "@/app/stores/ui";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { typeColor, typeIcon, useCardTypes } from "@/features/card-types";
import { useCardCounts } from "@/features/cards";
import { AssetImage, useAssets } from "@/features/media";
import { genreLabel, useCurrentWorld } from "@/features/world";
import type { TranslationKey } from "@/i18n";
import { cn } from "@/lib/utils";
import { RecentDocuments } from "./RecentDocuments";

const ENTRY_CLASS =
  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm outline-none transition focus-visible:ring-3 focus-visible:ring-ring/50";

/** An entry of the "Manage" block that is not available yet. */
function SoonEntry({
  icon: Icon,
  label,
  soon,
}: {
  icon: LucideIcon;
  label: TranslationKey;
  soon: string;
}) {
  const { t } = useTranslation();
  const soonId = useId();
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-disabled
            aria-describedby={soonId}
            onClick={(event) => event.preventDefault()}
            className={cn(ENTRY_CLASS, "cursor-not-allowed text-muted-foreground opacity-60")}
          >
            <Icon aria-hidden className="size-4" />
            {t(label)}
          </button>
        </TooltipTrigger>
        <TooltipContent>{soon}</TooltipContent>
      </Tooltip>
      <span id={soonId} className="sr-only">
        {soon}
      </span>
    </>
  );
}

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className={cn("glass flex flex-col gap-3 rounded-lg p-4", className)}
    >
      <h2 id={headingId} className="text-sm font-bold text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function EmptyState({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
      <Icon aria-hidden className="size-8 text-muted-foreground" />
      <p className="max-w-sm text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

/**
 * Home tab: the landing page of the open world. Welcome, recent documents,
 * "Manage" block, world summary and graph preview (empty until M2–M5).
 */
export function HomeScreen() {
  const { t } = useTranslation();
  const { data: world } = useCurrentWorld();
  const assets = useAssets({ kind: null, search: null });
  const cardCounts = useCardCounts();
  const types = useCardTypes();
  const openWorldPanel = useUiStore((state) => state.setWorldPanelOpen);
  const openCardTypes = useUiStore((state) => state.setCardTypesOpen);

  if (!world) return null;
  const fileCount = assets.data?.length;
  const counts = cardCounts.data;
  const cardTotal = counts?.reduce((sum, { count }) => sum + count, 0);
  // Subtypes count for their type; types in their order, empty ones left out.
  const allTypes = types.data ?? [];
  const byType = allTypes
    .filter((type) => type.parentId === null)
    .map((type) => ({
      type,
      count: (counts ?? [])
        .filter(({ typeId }) => {
          const counted = allTypes.find((candidate) => candidate.id === typeId);
          return typeId === type.id || counted?.parentId === type.id;
        })
        .reduce((sum, { count }) => sum + count, 0),
    }))
    .filter(({ count }) => count > 0);

  return (
    <main className="mx-auto flex h-full w-full max-w-6xl flex-col gap-6 overflow-y-auto px-8 pt-10 pb-8">
      <header className="flex items-center gap-5">
        {world.mainImage && (
          <AssetImage
            assetId={world.mainImage}
            alt=""
            className="size-20 shrink-0 rounded-xl object-cover shadow-lg"
          />
        )}
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="truncate text-4xl font-bold">
            {t("home.welcomeTo", { name: world.name })}
          </h1>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_16rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <Section title={t("home.recent")}>
            <RecentDocuments worldId={world.id} />
          </Section>

          <Section title={t("home.summary")}>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="text-muted-foreground">{t("createWorld.genre")}</dt>
              <dd>{t(genreLabel(world.genre))}</dd>
              <dt className="text-muted-foreground">{t("home.files")}</dt>
              <dd>{fileCount === undefined ? "" : t("home.fileCount", { count: fileCount })}</dd>
              <dt className="text-muted-foreground">{t("home.cards")}</dt>
              <dd>{cardTotal === undefined ? "" : t("home.cardCount", { count: cardTotal })}</dd>
            </dl>
            {byType.length > 0 && (
              <ul aria-label={t("home.cardsByType")} className="flex flex-wrap gap-1.5">
                {byType.map(({ type, count }) => {
                  const Icon = typeIcon(type.icon);
                  return (
                    <li
                      key={type.id}
                      className="flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-0.5 text-xs"
                    >
                      <Icon
                        aria-hidden
                        className="size-3.5"
                        style={{ color: typeColor(type.color) }}
                      />
                      {type.name}
                      <span className="text-muted-foreground">{count}</span>
                    </li>
                  );
                })}
              </ul>
            )}
            {world.description ? (
              <p className="text-sm whitespace-pre-line">{world.description}</p>
            ) : (
              <button
                type="button"
                onClick={() => openWorldPanel(true)}
                className="self-start text-sm text-muted-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {t("home.addDescription")}
              </button>
            )}
          </Section>

          <Section title={t("home.graph")}>
            <EmptyState icon={Share2} text={t("home.graphEmpty", { milestone: "M5" })} />
          </Section>
        </div>

        <Section title={t("home.manage")} className="self-start">
          <nav aria-label={t("home.manage")} className="-mx-2 flex flex-col">
            <button
              type="button"
              onClick={() => openCardTypes(true)}
              className={cn(ENTRY_CLASS, "text-left hover:bg-secondary")}
            >
              <Shapes aria-hidden className="size-4" />
              {t("home.types")}
            </button>
            <Link
              to="/world/$worldId/media"
              params={{ worldId: world.id }}
              className={cn(ENTRY_CLASS, "hover:bg-secondary")}
            >
              <Images aria-hidden className="size-4" />
              {t("media.title")}
            </Link>
            <SoonEntry icon={Palette} label="home.theme" soon={t("placeholder.comingSoon")} />
            <button
              type="button"
              onClick={() => openWorldPanel(true)}
              className={cn(ENTRY_CLASS, "text-left hover:bg-secondary")}
            >
              <Settings2 aria-hidden className="size-4" />
              {t("home.settings")}
            </button>
          </nav>
        </Section>
      </div>
    </main>
  );
}
