import type { TFunction } from "i18next";
import type { CSSProperties, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { typeColor } from "@/features/card-types";
import { type Block, rows, statsRules } from "@/features/cards";
import type { CardProperty, CardType, MapPin, WikiPage, Map as WorldMap } from "@/lib/bindings";
import { featuredPages } from "../pages";
import type { CardData, MapData, SiteData } from "./collect";
import { type MentionTarget, textHtml } from "./text";

/**
 * The exported site's pages (ADR 0008): static versions of the wiki's pages,
 * rendered to HTML. Links are relative (`index.html`, `pages/<id>.html`,
 * `assets/<id>`), so the folder opens with a double click, offline.
 */

/** What every page of the site needs. */
export type SiteContext = {
  data: SiteData;
  t: TFunction;
  language: string;
  /** "" for `index.html`, "../" for a page in `pages/`. */
  base: string;
  /** Ids of the wiki's pages. */
  pageIds: Set<string>;
};

export function pageFile(id: string): string {
  return `pages/${id}.html`;
}

function href(ctx: SiteContext, id: string): string {
  return `${ctx.base}${pageFile(id)}`;
}

/**
 * An image's file name in the site: the start of its hash and its extension,
 * as the Rust side copies it (short paths stay under Windows' 260 characters).
 */
export function assetFile(id: string): string {
  const [hash = "", extension] = id.split(".", 2);
  return extension === undefined ? hash.slice(0, 16) : `${hash.slice(0, 16)}.${extension}`;
}

function asset(ctx: SiteContext, id: string): string {
  return `${ctx.base}assets/${assetFile(id)}`;
}

function typeOf(ctx: SiteContext, id: string | null): CardType | undefined {
  return ctx.data.types.find((type) => type.id === id);
}

/** The images a page set needs, to copy into `assets/`. */
export function usedAssets(data: SiteData): string[] {
  const ids = new Set<string>();
  const add = (id: string | null | undefined) => {
    if (id) ids.add(id);
  };
  add(data.settings.bannerAssetId);
  for (const page of data.pages) add(page.imageAssetId);
  for (const card of data.cards) add(card.imageAssetId);
  for (const { blocks } of data.cardPages) {
    for (const block of blocks) {
      if (block.type === "image") for (const image of block.images) add(image.assetId);
    }
  }
  for (const map of data.maps.values()) add(map.backgroundAssetId);
  return [...ids];
}

/** A whole page: `<!doctype html>` and the static markup. */
export function renderDocument(element: ReactNode): string {
  return `<!doctype html>\n${renderToStaticMarkup(element)}`;
}

export function SiteDocument({
  ctx,
  title,
  children,
}: {
  ctx: SiteContext;
  title: string;
  children: ReactNode;
}) {
  return (
    <html lang={ctx.language}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <link rel="stylesheet" href={`${ctx.base}fonts.css`} />
        <link rel="stylesheet" href={`${ctx.base}style.css`} />
        <script src={`${ctx.base}search.js`} defer />
        <script src={`${ctx.base}site.js`} defer />
      </head>
      <body data-base={ctx.base}>
        <SiteNav ctx={ctx} />
        {children}
        <footer className="site-footer">{ctx.t("wiki.export.footer")}</footer>
      </body>
    </html>
  );
}

/** The bar of every page: the wiki's name, the pages by type, the search. */
function SiteNav({ ctx }: { ctx: SiteContext }) {
  const { t, data } = ctx;
  const byTitle = (a: WikiPage, b: WikiPage) => a.title.localeCompare(b.title);
  const groups = [
    ...data.types.map((type) => ({
      key: type.id,
      label: type.name,
      pages: data.pages.filter((page) => page.kind === "card" && page.typeId === type.id),
    })),
    {
      key: "none",
      label: t("cards.noType"),
      pages: data.pages.filter(
        (page) => page.kind === "card" && !data.types.some((type) => type.id === page.typeId),
      ),
    },
    {
      key: "maps",
      label: t("wiki.bar.maps"),
      pages: data.pages.filter((page) => page.kind === "map"),
    },
  ].filter((group) => group.pages.length > 0);
  return (
    <nav className="site-nav" aria-label={t("wiki.bar.label")}>
      <a className="site-title" href={`${ctx.base}index.html`}>
        {data.title}
      </a>
      {groups.length > 0 && (
        <details className="site-pages">
          <summary>{t("wiki.bar.pages")}</summary>
          <div className="site-pages-list">
            {groups.map((group) => (
              <section key={group.key}>
                <h2>{group.label}</h2>
                <ul>
                  {[...group.pages].sort(byTitle).map((page) => (
                    <li key={page.id}>
                      <a href={href(ctx, page.id)}>{page.title}</a>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </details>
      )}
      <SearchBox ctx={ctx} placeholder={t("wiki.bar.search")} />
    </nav>
  );
}

/** A search field; `site.js` fills its results from `search.js`. */
function SearchBox({ ctx, placeholder }: { ctx: SiteContext; placeholder: string }) {
  return (
    <search className="site-search">
      <input type="search" placeholder={placeholder} aria-label={placeholder} />
      <ul className="site-results" aria-label={ctx.t("wiki.home.results")} hidden />
      <p className="site-noresult" hidden>
        {ctx.t("wiki.home.noResult")}
      </p>
    </search>
  );
}

function Paragraphs({ text }: { text: string }) {
  return text
    .split(/\n{2,}/)
    .filter((part) => part.trim() !== "")
    .map((part, index) => (
      // biome-ignore lint/suspicious/noArrayIndexKey: static paragraphs, never reordered.
      <p key={index}>{part}</p>
    ));
}

export function HomePage({ ctx }: { ctx: SiteContext }) {
  const { data, t } = ctx;
  const featured = featuredPages(data.settings.featured, data.pages);
  const slides = featured.filter((page) => page.imageAssetId);
  return (
    <SiteDocument ctx={ctx} title={data.title}>
      <main className="home">
        {slides.length > 0 && (
          <section className="hero" aria-label={t("wiki.hero.label")}>
            {slides.map((page, index) => (
              <a key={page.id} href={href(ctx, page.id)} className="hero-slide" hidden={index > 0}>
                <img src={asset(ctx, page.imageAssetId ?? "")} alt="" />
                <span>{page.title}</span>
              </a>
            ))}
          </section>
        )}
        <div className="home-main">
          {data.settings.bannerAssetId && (
            <img className="banner" src={asset(ctx, data.settings.bannerAssetId)} alt="" />
          )}
          <h1>{data.title}</h1>
          <div className="description">
            <Paragraphs text={data.settings.description} />
          </div>
          <SearchBox ctx={ctx} placeholder={t("wiki.home.search", { title: data.title })} />
          {featured.length > 0 && (
            <section className="featured">
              <h2>{t("wiki.grid.title")}</h2>
              <ul className="tiles">
                {featured.map((page) => (
                  <li key={page.id}>
                    <a href={href(ctx, page.id)} className="tile">
                      {page.imageAssetId && <img src={asset(ctx, page.imageAssetId)} alt="" />}
                      <span>{page.title}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </main>
    </SiteDocument>
  );
}

function mentionTarget(ctx: SiteContext): MentionTarget {
  return (id) => {
    const card = ctx.data.cards.find((candidate) => candidate.id === id);
    if (!card) return null;
    return { name: card.title, href: ctx.pageIds.has(id) ? href(ctx, id) : null };
  };
}

/** A card or map by its id: a link to its page, or its name only. */
function DocumentName({ ctx, id, name }: { ctx: SiteContext; id: string; name: string }) {
  return ctx.pageIds.has(id) ? <a href={href(ctx, id)}>{name}</a> : <span>{name}</span>;
}

function PropertyValue({ ctx, property }: { ctx: SiteContext; property: CardProperty }) {
  const value = property.value;
  if (!value) return null;
  if (value.kind === "text") return <>{value.value}</>;
  if (value.kind === "number") return <>{value.value ?? ""}</>;
  const ids = value.kind === "card" ? [value.value] : value.value;
  const names = ids.flatMap((id) => {
    const card = ctx.data.cards.find((candidate) => candidate.id === id);
    return card ? [{ id, name: card.title }] : [];
  });
  return (
    <>
      {names.map(({ id, name }, index) => (
        <span key={id}>
          {index > 0 && ", "}
          <DocumentName ctx={ctx} id={id} name={name} />
        </span>
      ))}
    </>
  );
}

function BlockView({ ctx, block }: { ctx: SiteContext; block: Block }) {
  const { t } = ctx;
  if (block.type === "text") {
    return (
      <div
        className="prose"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: TipTap's own HTML of the card's text.
        dangerouslySetInnerHTML={{ __html: textHtml(block.doc, mentionTarget(ctx)) }}
      />
    );
  }
  if (block.type === "image") {
    return (
      <div className="gallery">
        {block.images.map((image) => (
          <figure key={image.id}>
            <img src={asset(ctx, image.assetId)} alt={image.caption} />
            {image.caption && <figcaption>{image.caption}</figcaption>}
          </figure>
        ))}
      </div>
    );
  }
  if (block.type === "map") {
    const map = block.mapId ? ctx.data.maps.get(block.mapId) : undefined;
    if (!map) return null;
    return (
      <figure className="map-block">
        <MapDrawing ctx={ctx} map={map} />
        <figcaption>
          <DocumentName ctx={ctx} id={map.id} name={map.title} />
        </figcaption>
      </figure>
    );
  }
  const { ABILITIES, SKILLS, formatBonus, modifier, skillBonus } = statsRules;
  return (
    <section className="stats" aria-label={t("stats.title")}>
      <dl className="abilities">
        {ABILITIES.map((ability) => (
          <div key={ability}>
            <dt>{t(`stats.abilityShort.${ability}`)}</dt>
            <dd>
              {`${block.abilities[ability]} (${formatBonus(modifier(block.abilities[ability]))})`}
            </dd>
          </div>
        ))}
      </dl>
      <dl className="stats-lines">
        {block.armorClass !== null && (
          <div>
            <dt>{t("stats.armorClass")}</dt>
            <dd>{block.armorClass}</dd>
          </div>
        )}
        {block.hitPoints !== null && (
          <div>
            <dt>{t("stats.hitPoints")}</dt>
            <dd>
              {block.hitPoints}
              {block.hitDice && ` (${block.hitDice})`}
            </dd>
          </div>
        )}
        {block.speed && (
          <div>
            <dt>{t("stats.speed")}</dt>
            <dd>{block.speed}</dd>
          </div>
        )}
        <div>
          <dt>{t("stats.proficiencyBonus")}</dt>
          <dd>{formatBonus(block.proficiencyBonus)}</dd>
        </div>
        {block.skills.length > 0 && (
          <div>
            <dt>{t("stats.skillsShort")}</dt>
            <dd>
              {SKILLS.filter((skill) => block.skills.includes(skill.key))
                .map(
                  (skill) =>
                    `${t(`stats.skill.${skill.key}`)} ${formatBonus(
                      skillBonus(block.abilities[skill.ability], true, block.proficiencyBonus),
                    )}`,
                )
                .join(", ")}
            </dd>
          </div>
        )}
      </dl>
      {block.actions.length > 0 && (
        <>
          <h3>{t("stats.actions")}</h3>
          {block.actions.map((action) => (
            <p key={action.id}>
              <strong>{`${action.name}.`}</strong> {action.description}
            </p>
          ))}
        </>
      )}
    </section>
  );
}

export function CardPageView({ ctx, card }: { ctx: SiteContext; card: CardData }) {
  const { t } = ctx;
  const type = typeOf(ctx, card.card.typeId);
  const parent = type?.parentId ? typeOf(ctx, type.parentId) : undefined;
  const shownProperties = card.properties.filter((property) => property.value !== null);
  const cited = card.backlinks.filter((backlink) => ctx.pageIds.has(backlink.sourceId));
  return (
    <SiteDocument ctx={ctx} title={`${card.card.title} — ${ctx.data.title}`}>
      <main className="page card-page">
        {card.card.imageAssetId && (
          <img className="card-image" src={asset(ctx, card.card.imageAssetId)} alt="" />
        )}
        <article>
          <h1>{card.card.title}</h1>
          {type && (
            <p className="card-type" style={{ "--type": typeColor(type.color) } as CSSProperties}>
              {parent ? `${parent.name} › ${type.name}` : type.name}
            </p>
          )}
          {shownProperties.length > 0 && (
            <dl className="properties" aria-label={t("properties.title")}>
              {shownProperties.map((property) => (
                <div key={property.definition.id}>
                  <dt>{property.definition.label}</dt>
                  <dd>
                    <PropertyValue ctx={ctx} property={property} />
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {rows(card.blocks).map((row, index) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: static rows, never reordered.
              key={index}
              className="block-row"
              style={{
                gridTemplateColumns: row.blocks.map((block) => `${block.width ?? 1}fr`).join(" "),
              }}
            >
              {row.blocks.map((block) => (
                <BlockView key={block.id} ctx={ctx} block={block} />
              ))}
            </div>
          ))}
          {cited.length > 0 && (
            <section className="cited">
              <h2>{t("backlinks.title")}</h2>
              <ul>
                {cited.map((backlink) => (
                  <li key={backlink.sourceId}>
                    <a href={href(ctx, backlink.sourceId)}>{backlink.sourceTitle}</a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>
      </main>
    </SiteDocument>
  );
}

/** A map drawn read only: its background, visible zones, texts and pins. */
function MapDrawing({ ctx, map }: { ctx: SiteContext; map: WorldMap }) {
  const { content } = map;
  const hidden = new Set(content.layers.filter((layer) => !layer.visible).map((layer) => layer.id));
  const pins = content.pins.filter((pin) => !hidden.has(pin.layerId));
  const at = (x: number | null, y: number | null): CSSProperties => ({
    left: `${(x ?? 0) * 100}%`,
    top: `${(y ?? 0) * 100}%`,
  });
  return (
    <div className="map" style={{ aspectRatio: `${map.width} / ${map.height}` }}>
      {map.backgroundAssetId && <img src={asset(ctx, map.backgroundAssetId)} alt="" />}
      <svg viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
        {content.zones
          .filter((zone) => !hidden.has(zone.layerId))
          .map((zone) => (
            <polygon
              key={zone.id}
              points={zone.points.map(([x, y]) => `${x ?? 0},${y ?? 0}`).join(" ")}
              style={{
                fill: typeColor(zone.fillColor),
                fillOpacity: zone.opacity ?? 0.35,
                stroke: typeColor(zone.fillColor),
              }}
              vectorEffect="non-scaling-stroke"
            />
          ))}
      </svg>
      {content.zones
        .filter((zone) => !hidden.has(zone.layerId) && zone.label)
        .map((zone) => {
          const xs = zone.points.map(([x]) => x ?? 0);
          const ys = zone.points.map(([, y]) => y ?? 0);
          const center = {
            x: xs.reduce((a, b) => a + b, 0) / xs.length,
            y: ys.reduce((a, b) => a + b, 0) / ys.length,
          };
          return (
            <span key={zone.id} className="map-label" style={at(center.x, center.y)}>
              {zone.label}
            </span>
          );
        })}
      {content.texts
        .filter((text) => !hidden.has(text.layerId))
        .map((text) => (
          <span
            key={text.id}
            className="map-text"
            style={{
              ...at(text.x, text.y),
              fontSize: `${((text.style.size ?? 16) / map.width) * 100}cqw`,
            }}
          >
            {text.text}
          </span>
        ))}
      {pins.map((pin) => (
        <MapPinView key={pin.id} ctx={ctx} pin={pin} style={at(pin.x, pin.y)} />
      ))}
    </div>
  );
}

function MapPinView({ ctx, pin, style }: { ctx: SiteContext; pin: MapPin; style: CSSProperties }) {
  const card = pin.cardId ? ctx.data.cards.find((candidate) => candidate.id === pin.cardId) : null;
  const type = card ? typeOf(ctx, card.typeId) : undefined;
  const color = typeColor(card ? (type?.color ?? "slate") : pin.color);
  const label = card ? card.title : pin.label;
  const content = (
    <>
      <span className="pin-disc" style={{ backgroundColor: color }}>
        {card?.imageAssetId && <img src={asset(ctx, card.imageAssetId)} alt="" />}
      </span>
      {label && <span className="pin-label">{label}</span>}
    </>
  );
  return card && ctx.pageIds.has(card.id) ? (
    <a className="pin" href={href(ctx, card.id)} style={style}>
      {content}
    </a>
  ) : (
    <span className="pin" style={style}>
      {content}
    </span>
  );
}

export function MapPageView({ ctx, map }: { ctx: SiteContext; map: MapData }) {
  const { t } = ctx;
  const content = map.map.content;
  const hidden = new Set(content.layers.filter((layer) => !layer.visible).map((layer) => layer.id));
  const linked = ctx.data.pages
    .filter((page) =>
      content.pins.some((pin) => !hidden.has(pin.layerId) && pin.cardId === page.id),
    )
    .sort((a, b) => a.title.localeCompare(b.title));
  return (
    <SiteDocument ctx={ctx} title={`${map.map.title} — ${ctx.data.title}`}>
      <main className="page map-page">
        <h1>{map.map.title}</h1>
        <MapDrawing ctx={ctx} map={map.map} />
        {linked.length > 0 && (
          <section className="cited">
            <h2>{t("wiki.map.onMap")}</h2>
            <ul>
              {linked.map((page) => (
                <li key={page.id}>
                  <a href={href(ctx, page.id)}>{page.title}</a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </SiteDocument>
  );
}
