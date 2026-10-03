import { type Block, parseContent } from "@/features/cards";
import {
  type Backlink,
  type Card,
  type CardProperty,
  type CardType,
  commands,
  type WikiPage,
  type WikiSettings,
  type Map as WorldMap,
} from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";

/** A card page of the site, with all it shows. */
export type CardData = {
  page: WikiPage;
  card: Card;
  blocks: Block[];
  properties: CardProperty[];
  backlinks: Backlink[];
};

/** A map page of the site. */
export type MapData = { page: WikiPage; map: WorldMap };

/** Everything the exported site is made of, read from the world. */
export type SiteData = {
  settings: WikiSettings;
  /** The wiki's title (its own, or the world's name). */
  title: string;
  pages: WikiPage[];
  types: CardType[];
  /** The world's live cards, for the names of mentions and links. */
  cards: Card[];
  cardPages: CardData[];
  mapPages: MapData[];
  /** The maps shown in card blocks, by id (pages or not). */
  maps: Map<string, WorldMap>;
};

/**
 * Reads the wiki from the world, page by page (`onPage` tells how many are
 * read).
 */
export async function collectSite(
  worldName: string,
  onPage: (done: number, total: number) => void,
): Promise<SiteData> {
  const [settings, pages, types, cards] = await Promise.all([
    unwrap(commands.wikiSettings()),
    unwrap(commands.wikiPages()),
    unwrap(commands.listCardTypes()),
    unwrap(commands.listCards(false)),
  ]);
  const cardPages: CardData[] = [];
  const mapPages: MapData[] = [];
  const maps = new Map<string, WorldMap>();
  const readMap = async (id: string) => {
    const known = maps.get(id);
    if (known) return known;
    const map = await unwrap(commands.getMap(id));
    maps.set(id, map);
    return map;
  };
  let done = 0;
  for (const page of pages) {
    if (page.kind === "map") {
      mapPages.push({ page, map: await readMap(page.id) });
    } else {
      const [card, content, properties, backlinks] = await Promise.all([
        unwrap(commands.getCard(page.id)),
        unwrap(commands.getCardContent(page.id)),
        unwrap(commands.cardProperties(page.id)),
        unwrap(commands.cardBacklinks(page.id)),
      ]);
      const blocks = parseContent(content);
      for (const block of blocks) {
        // A map shown in the card: drawn in the page even without its own page.
        if (block.type === "map" && block.mapId) await readMap(block.mapId).catch(() => null);
      }
      cardPages.push({ page, card, blocks, properties, backlinks });
    }
    done += 1;
    onPage(done, pages.length);
  }
  return {
    settings,
    title: settings.title || worldName,
    pages,
    types,
    cards,
    cardPages,
    mapPages,
    maps,
  };
}
