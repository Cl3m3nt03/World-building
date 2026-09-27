import { ImageOff, ImagePlus, RefreshCw } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AssetImage, ImagePickerDialog, useAssets } from "@/features/media";
import type { ImageBlock } from "./model";

type ImageBlockViewProps = {
  block: ImageBlock;
  /** Accessible name of the block ("Image block 2"). */
  label: string;
  onChange: (block: ImageBlock) => void;
  /** The block was just inserted: the image picker opens right away. */
  pickOnMount: boolean;
};

/**
 * An image of the media library with a caption. Without an image (just
 * inserted, or the image was deleted from the media library), the block
 * offers to choose one.
 */
export function ImageBlockView({ block, label, onChange, pickOnMount }: ImageBlockViewProps) {
  const { t } = useTranslation();
  const [picking, setPicking] = useState(pickOnMount);
  // The image is gone if the media library no longer has it (deleted while
  // still used here; the WebView may still show it from its cache), or if
  // its file cannot be read. Choosing another image clears it.
  const images = useAssets({ kind: "image", search: null });
  const [failedId, setFailedId] = useState<string | null>(null);
  const missing =
    block.assetId !== null &&
    (block.assetId === failedId ||
      (images.data !== undefined && !images.data.some((asset) => asset.id === block.assetId)));
  const captionId = useId();

  const choose = (
    <Button variant="secondary" size="sm" onClick={() => setPicking(true)}>
      {block.assetId ? <RefreshCw /> : <ImagePlus />}
      {block.assetId ? t("blocks.image.change") : t("blocks.image.choose")}
    </Button>
  );

  return (
    <figure aria-label={label} className="flex flex-col gap-2">
      {!block.assetId ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-6 text-sm text-muted-foreground">
          <ImagePlus aria-hidden className="size-6" />
          {t("blocks.image.empty")}
          {choose}
        </div>
      ) : missing ? (
        <div
          role="alert"
          className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-destructive/40 py-6 text-sm text-muted-foreground"
        >
          <ImageOff aria-hidden className="size-6" />
          {t("blocks.image.missing")}
          {choose}
        </div>
      ) : (
        <div className="group relative self-start">
          <AssetImage
            assetId={block.assetId}
            alt={block.caption}
            onError={() => setFailedId(block.assetId)}
            className="max-h-[28rem] max-w-full rounded-lg object-contain"
          />
          <div className="absolute top-2 right-2 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100">
            {choose}
          </div>
        </div>
      )}
      {block.assetId && !missing && (
        <figcaption>
          <label htmlFor={captionId} className="sr-only">
            {t("blocks.image.caption")}
          </label>
          <Input
            id={captionId}
            value={block.caption}
            maxLength={500}
            placeholder={t("blocks.image.captionPlaceholder")}
            onChange={(event) => onChange({ ...block, caption: event.target.value })}
            className="h-8 border-transparent bg-transparent px-1 text-sm text-muted-foreground shadow-none hover:border-border focus-visible:border-ring dark:bg-transparent"
          />
        </figcaption>
      )}
      <ImagePickerDialog
        open={picking}
        onOpenChange={setPicking}
        selectedId={block.assetId}
        onPick={(assetId) => onChange({ ...block, assetId })}
      />
    </figure>
  );
}
