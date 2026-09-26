import { getCurrentWebview } from "@tauri-apps/api/webview";
import { ImageUp } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { cn } from "@/lib/utils";
import { useImportAsset } from "../hooks/useImportAsset";
import { AssetImage } from "./AssetImage";

/**
 * Temporary import area (M0 step 0.10): drop a file on the window to import it
 * into the open world and preview it. The media library (M1) replaces it.
 */
export function ImportDropZone() {
  const { t } = useTranslation();
  const importAsset = useImportAsset();
  const { mutate } = importAsset;
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let disposed = false;

    let webview: ReturnType<typeof getCurrentWebview>;
    try {
      webview = getCurrentWebview();
    } catch (error) {
      // Outside Tauri (tests, plain browser) there is no webview to listen to.
      console.warn("Drag and drop unavailable", error);
      return;
    }

    webview
      .onDragDropEvent(({ payload }) => {
        if (payload.type === "enter" || payload.type === "over") {
          setHovering(true);
        } else {
          setHovering(false);
          const [first] = payload.type === "drop" ? payload.paths : [];
          if (first !== undefined) mutate(first);
        }
      })
      .then((stop) => {
        if (disposed) stop();
        else unlisten = stop;
      })
      .catch((error: unknown) => console.warn("Drag and drop unavailable", error));

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [mutate]);

  const imported = importAsset.data;

  return (
    <section
      aria-label={t("media.dropZone")}
      className={cn(
        "glass flex flex-col items-center gap-3 rounded-lg border-dashed p-6 text-center transition-colors",
        hovering && "border-primary",
      )}
    >
      <ImageUp aria-hidden className="size-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        {hovering ? t("media.dropActive") : t("media.dropHint")}
      </p>
      {importAsset.isPending && <p className="text-sm">{t("media.importing")}</p>}
      {importAsset.isError && <AppErrorMessage error={importAsset.error} />}
      {imported && (
        <figure className="flex flex-col items-center gap-2">
          <AssetImage
            assetId={imported.asset.id}
            alt={t("media.previewAlt", { name: imported.asset.name })}
            className="max-h-64 rounded-md object-contain"
          />
          <figcaption className="text-xs text-muted-foreground">
            {t(imported.created ? "media.imported" : "media.alreadyImported", {
              name: imported.asset.name,
            })}
          </figcaption>
        </figure>
      )}
    </section>
  );
}
