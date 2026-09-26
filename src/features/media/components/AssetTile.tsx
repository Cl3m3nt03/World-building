import { FileQuestion, Music } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Asset } from "@/lib/bindings";
import { formatBytes } from "@/lib/format";
import { AssetImage } from "./AssetImage";

/** One file of the media library: preview, name, kind and size. */
export function AssetTile({ asset }: { asset: Asset }) {
  const { t, i18n } = useTranslation();
  const Icon = asset.kind === "audio" ? Music : FileQuestion;

  return (
    <figure className="glass flex flex-col overflow-hidden rounded-lg">
      <div className="flex aspect-square items-center justify-center overflow-hidden bg-muted">
        {asset.kind === "image" ? (
          <AssetImage assetId={asset.id} alt={asset.name} className="size-full object-cover" />
        ) : (
          <Icon aria-hidden className="size-10 text-muted-foreground" />
        )}
      </div>
      <figcaption className="flex flex-col gap-0.5 p-2">
        <span className="truncate text-sm" title={asset.name}>
          {asset.name}
        </span>
        <span className="flex justify-between gap-2 text-xs text-muted-foreground">
          <span>{t(`media.kind.${asset.kind}`)}</span>
          <span>{formatBytes(asset.size ?? 0, i18n.language)}</span>
        </span>
      </figcaption>
    </figure>
  );
}
