import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { typeColor, typeIcon, useCardTypes } from "@/features/card-types";
import {
  Backlinks,
  CardContent,
  CardImage,
  CardProperties,
  typeLabel,
  useCard,
} from "@/features/cards";
import { wikiCardRoute } from "@/lib/documentRoute";
import { cn } from "@/lib/utils";
import { useWikiPages } from "../hooks/useWiki";
import { useWikiLinks } from "../links";
import { WIKI_BUTTON, WIKI_FOCUS } from "./styles";

/**
 * A card's page in the wiki (docs/features/07-wiki.md): its image, type,
 * properties, content and "Cité dans". The same card as in World: its text,
 * images and properties are edited here too. A mention or a link to a card
 * without a page is plain text.
 */
export function WikiCardPage() {
  const { worldId, cardId } = useParams({ from: "/world/$worldId/wiki/card/$cardId" });
  const navigate = useNavigate();
  const card = useCard(cardId);
  const types = useCardTypes();
  const pages = useWikiPages();
  const { isPage } = useWikiLinks();

  if (card.isError) {
    return (
      <div className="p-6">
        <AppErrorMessage error={card.error} />
      </div>
    );
  }
  if (!card.data || !pages.data) return null;
  if (!isPage(cardId)) return <NotInWiki />;

  const all = types.data ?? [];
  const type = all.find((candidate) => candidate.id === card.data.typeId);
  const Icon = typeIcon(type?.icon ?? "shapes");

  return (
    <article aria-label={card.data.title} className="scrollbar-thin h-full overflow-y-auto">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 p-6">
        <HomeLink />
        <div className="grid gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="md:sticky md:top-0 md:self-start">
            <CardImage card={card.data} type={type} className="w-full" />
          </div>
          <div className="flex min-w-0 flex-col gap-6">
            <header className="flex flex-col gap-2">
              <h1 className="font-wiki-heading text-4xl font-bold text-wiki-accent">
                {card.data.title}
              </h1>
              {type && (
                <p className="flex items-center gap-1.5 text-sm text-wiki-muted">
                  <Icon aria-hidden className="size-4" style={{ color: typeColor(type.color) }} />
                  {typeLabel(type, all)}
                </p>
              )}
            </header>
            <div className="rounded-lg border border-wiki-text/15 bg-wiki-surface p-4">
              <CardProperties key={`${card.data.id}-${card.data.typeId}`} cardId={card.data.id} />
            </div>
            <CardContent
              card={card.data}
              canOpen={isPage}
              open={(id) => void navigate(wikiCardRoute(worldId, id))}
            />
            <Backlinks cardId={card.data.id} />
          </div>
        </div>
      </div>
    </article>
  );
}

function HomeLink() {
  const { t } = useTranslation();
  const { worldId } = useParams({ from: "/world/$worldId" });
  return (
    <Link
      to="/world/$worldId/wiki"
      params={{ worldId }}
      className={cn(
        "flex items-center gap-1.5 self-start rounded text-sm text-wiki-muted hover:text-wiki-text [&_svg]:size-4",
        WIKI_FOCUS,
      )}
    >
      <ArrowLeft aria-hidden />
      {t("wiki.page.home")}
    </Link>
  );
}

/** A card without a page in the wiki (hidden since, or never shown). */
function NotInWiki() {
  const { t } = useTranslation();
  const { worldId } = useParams({ from: "/world/$worldId" });
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <EyeOff aria-hidden className="size-8 text-wiki-muted" />
      <p className="font-wiki-heading text-lg font-bold">{t("wiki.page.hidden")}</p>
      <Link to="/world/$worldId/wiki" params={{ worldId }} className={WIKI_BUTTON}>
        {t("wiki.page.home")}
      </Link>
    </div>
  );
}
