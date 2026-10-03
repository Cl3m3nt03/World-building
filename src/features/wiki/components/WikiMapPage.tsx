import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useId, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { useCardTypes } from "@/features/card-types";
import { useCardList } from "@/features/cards";
import { hiddenLayers, MapTextView, MapView, PinMarker, useMap } from "@/features/maps";
import type { MapPin } from "@/lib/bindings";
import { wikiCardRoute } from "@/lib/documentRoute";
import { cn } from "@/lib/utils";
import { useWikiPages } from "../hooks/useWiki";
import { useWikiLinks } from "../links";
import { PageIcon } from "./PageIcon";
import { HomeLink, NotInWiki } from "./PageParts";
import { WIKI_FOCUS } from "./styles";

/**
 * A map's page in the wiki (docs/features/07-wiki.md): the map read only,
 * with its visible layers (zones, texts, pins). A click on the pin of a card
 * with a page opens that page; the same pages are listed under the map, for
 * the keyboard.
 */
export function WikiMapPage() {
  const { t } = useTranslation();
  const { worldId, mapId } = useParams({ from: "/world/$worldId/wiki/map/$mapId" });
  const navigate = useNavigate();
  const map = useMap(mapId);
  const cards = useCardList(false);
  const types = useCardTypes();
  const pages = useWikiPages();
  const { isPage } = useWikiLinks();
  const listId = useId();
  const content = map.data?.content;

  const hidden = useMemo(() => (content ? hiddenLayers(content) : new Set<string>()), [content]);
  const pins = useMemo(
    () => content?.pins.filter((pin) => !hidden.has(pin.layerId)) ?? [],
    [content, hidden],
  );
  const markers = useMemo(
    () => [...(content?.texts.filter((text) => !hidden.has(text.layerId)) ?? []), ...pins],
    [content, hidden, pins],
  );
  const zones = useMemo(
    () => content?.zones.filter((zone) => !hidden.has(zone.layerId)) ?? [],
    [content, hidden],
  );
  const cardsById = useMemo(
    () => new Map((cards.data ?? []).map((card) => [card.id, card])),
    [cards.data],
  );
  const typesById = useMemo(
    () => new Map((types.data ?? []).map((type) => [type.id, type])),
    [types.data],
  );

  if (map.isError) {
    return (
      <div className="p-6">
        <AppErrorMessage error={map.error} />
      </div>
    );
  }
  if (!map.data || !content || !pages.data) return null;
  if (!isPage(mapId)) return <NotInWiki message={t("wiki.map.hidden")} />;

  const cardOf = (pin: MapPin) => (pin.cardId ? cardsById.get(pin.cardId) : undefined);
  // The pages on the map, once each, by name.
  const linked = pages.data
    .filter((page) => pins.some((pin) => pin.cardId === page.id))
    .sort((a, b) => a.title.localeCompare(b.title));
  const open = (pinId: string) => {
    const cardId = pins.find((pin) => pin.id === pinId)?.cardId;
    if (cardId && isPage(cardId)) void navigate(wikiCardRoute(worldId, cardId));
  };

  return (
    <article aria-label={map.data.title} className="scrollbar-thin h-full overflow-y-auto">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 p-6">
        <HomeLink />
        <h1 className="font-wiki-heading text-4xl font-bold text-wiki-accent">{map.data.title}</h1>
        <div className="h-[70vh] min-h-80 overflow-hidden rounded-lg border border-wiki-text/15">
          <MapView
            readOnly
            backgroundAssetId={map.data.backgroundAssetId}
            tiles={map.data.tiled ? { mapId: map.data.id } : null}
            width={map.data.width}
            height={map.data.height}
            label={t("maps.viewLabel", { name: map.data.title })}
            markers={markers}
            zones={zones}
            zoneLabel={(zone) =>
              t("maps.zones.ariaLabel", { name: zone.label || t("maps.pins.unnamed") })
            }
            markerLabel={(id) => {
              const pin = pins.find((other) => other.id === id);
              const text = content.texts.find((other) => other.id === id);
              return (pin && (cardOf(pin)?.title ?? pin.label)) || text?.text || "";
            }}
            renderMarker={(id, zoomScale) => {
              const text = content.texts.find((other) => other.id === id);
              if (text) return <MapTextView text={text} zoomScale={zoomScale} selected={false} />;
              const pin = pins.find((other) => other.id === id);
              if (!pin) return null;
              const card = cardOf(pin);
              return (
                <PinMarker
                  pin={pin}
                  card={card}
                  type={card?.typeId ? typesById.get(card.typeId) : undefined}
                  selected={false}
                />
              );
            }}
            onMarkerClick={open}
          />
        </div>
        {linked.length > 0 && (
          <section aria-labelledby={listId} className="flex flex-col gap-2">
            <h2 id={listId} className="font-wiki-heading text-lg font-bold">
              {t("wiki.map.onMap")}
            </h2>
            <ul className="flex flex-wrap gap-2">
              {linked.map((page) => (
                <li key={page.id}>
                  <Link
                    {...wikiCardRoute(worldId, page.id)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border border-wiki-text/15 bg-wiki-surface px-3 py-1 text-sm hover:bg-wiki-background",
                      WIKI_FOCUS,
                    )}
                  >
                    <PageIcon page={page} className="size-4" />
                    {page.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </article>
  );
}
