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
