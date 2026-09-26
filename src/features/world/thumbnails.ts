import { convertFileSrc } from "@tauri-apps/api/core";
import type { RecentWorld } from "@/lib/bindings";

/** Protocol serving cached world thumbnails (src-tauri/src/thumbnails.rs). */
const THUMBNAIL_SCHEME = "bzthumb";

/** Bumped when a thumbnail is regenerated in this session, to bust the WebView cache. */
let generation = 0;

export function thumbnailsChanged() {
  generation += 1;
}

/** URL of the cached thumbnail of a recent world, or `undefined` without one. */
export function thumbnailUrl(world: RecentWorld): string | undefined {
  if (!world.thumbnail || !world.id) return undefined;
  const version = encodeURIComponent(`${world.lastOpenedAt}-${generation}`);
  return `${convertFileSrc(world.id, THUMBNAIL_SCHEME)}?v=${version}`;
}
