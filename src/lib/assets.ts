import { convertFileSrc } from "@tauri-apps/api/core";
import { useMemo } from "react";

/** Custom protocol serving the open world's assets (src-tauri/src/protocol.rs). */
export const ASSET_SCHEME = "bzasset";

/** URL of an asset of the open world, usable in `<img src>` or `<audio src>`. */
export function assetUrl(assetId: string): string {
  return convertFileSrc(assetId, ASSET_SCHEME);
}

/** URL of an asset, or `undefined` while there is no asset id. */
export function useAssetUrl(assetId: string | null | undefined): string | undefined {
  return useMemo(() => (assetId ? assetUrl(assetId) : undefined), [assetId]);
}

/** Custom protocol serving the library shared by the worlds (ADR 0006). */
export const LIBRARY_SCHEME = "bzlibrary";

/** URL of an asset of the library shared by the worlds. */
export function libraryAssetUrl(assetId: string): string {
  return convertFileSrc(assetId, LIBRARY_SCHEME);
}

/** Custom protocol serving the tiles of very large map backgrounds (M4 4.3). */
export const TILES_SCHEME = "bztiles";

/** Leaflet URL template of a map's tiles: `<map id>/{z}/{x}/{y}.jpg`. */
export function tilesUrlTemplate(mapId: string): string {
  // The base for this platform (http://bztiles.localhost/ on Windows),
  // then the path unencoded so that Leaflet can fill in {z}, {x} and {y}.
  return `${convertFileSrc("", TILES_SCHEME)}${mapId}/{z}/{x}/{y}.jpg`;
}
