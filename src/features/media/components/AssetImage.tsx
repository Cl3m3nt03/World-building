import type { ComponentProps } from "react";
import { libraryAssetUrl, useAssetUrl } from "@/lib/assets";

type AssetImageProps = Omit<ComponentProps<"img">, "src"> & {
  assetId: string;
  alt: string;
  /** The asset is in the library shared by the worlds, not in the open world. */
  library?: boolean;
};

/** An image stored in the open world's assets, or in the library. */
export function AssetImage({ assetId, alt, library = false, ...props }: AssetImageProps) {
  const worldSrc = useAssetUrl(library ? null : assetId);
  return <img src={library ? libraryAssetUrl(assetId) : worldSrc} alt={alt} {...props} />;
}
