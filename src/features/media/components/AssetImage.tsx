import type { ComponentProps } from "react";
import { useAssetUrl } from "@/lib/assets";

type AssetImageProps = Omit<ComponentProps<"img">, "src"> & {
  assetId: string;
  alt: string;
};

/** An image stored in the open world's assets. */
export function AssetImage({ assetId, alt, ...props }: AssetImageProps) {
  const src = useAssetUrl(assetId);
  return <img src={src} alt={alt} {...props} />;
}
