import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ExternalLink, Map as MapIcon, RefreshCw } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { typeColor, typeIcon } from "@/features/card-types";
import { MapTextView } from "@/features/maps/components/MapTextView";
import { MapView, type MapViewHandle } from "@/features/maps/components/MapView";
import { useMap } from "@/features/maps/hooks/useMaps";
import { hiddenLayers } from "@/features/maps/layers";
import { commands } from "@/lib/bindings";
import { useDocumentLink } from "@/lib/documentLinks";
import { unwrap } from "@/lib/ipc";
import { documentKeys } from "../hooks/keys";
import type { MapBlock } from "./model";

/** Live maps of the world, by title, to choose the one a block shows. */
function useWorldMaps() {
  return useQuery({
    queryKey: [...documentKeys.all(), "maps"],
    queryFn: () => unwrap(commands.listDocuments({ kind: "map", trashed: false })),
  });
}

/**
 * A map of the world inside a card (M4 step 4.10): chosen among the maps,
 * shown read-only (drag to move, + / - to zoom; the wheel scrolls the
 * card), with a button to open it.
 */
export function MapBlockView({
  block,
  label,
  onChange,
}: {
  block: MapBlock;
  label: string;
  onChange: (block: MapBlock) => void;
}) {
  const { t } = useTranslation();
  const maps = useWorldMaps();
  const [choosing, setChoosing] = useState(block.mapId === null);
  const selectId = useId();

  const chooser = (
    <div className="flex items-end gap-2">
      <div className="flex min-w-48 flex-col gap-1">
        <label htmlFor={selectId} className="text-sm text-muted-foreground">
          {t("blocks.map.choose")}
        </label>
        <Select
          value={block.mapId ?? ""}
          onValueChange={(mapId) => {
            onChange({ ...block, mapId });
            setChoosing(false);
          }}
          // Closed on the same map (no change), or with Escape: back to it.
          onOpenChange={(open) => {
            if (!open && block.mapId !== null) setChoosing(false);
          }}
        >
          <SelectTrigger id={selectId} size="sm">
            <SelectValue placeholder={t("blocks.map.placeholder")} />
          </SelectTrigger>
          <SelectContent>
            {(maps.data ?? []).map((map) => (
              <SelectItem key={map.id} value={map.id}>
                {map.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  return (
    <figure aria-label={label} className="flex flex-col gap-2">
      {block.mapId === null || choosing ? (
        maps.data && maps.data.length === 0 ? (
          <p className="flex items-center gap-2 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            <MapIcon aria-hidden className="size-5" />
            {t("blocks.map.none")}
          </p>
        ) : (
          chooser
        )
      ) : (
        <MapPreview mapId={block.mapId} onChange={() => setChoosing(true)} />
      )}
    </figure>
  );
}

function MapPreview({ mapId, onChange }: { mapId: string; onChange: () => void }) {
  const { t } = useTranslation();
  const link = useDocumentLink()("map", mapId);
  const map = useMap(mapId);
  const view = useRef<MapViewHandle>(null);
  const content = map.data?.content;
  const hidden = useMemo(() => (content ? hiddenLayers(content) : new Set<string>()), [content]);
  const markers = useMemo(
    () =>
      content
        ? [
            ...content.texts.filter((text) => !hidden.has(text.layerId)),
            ...content.pins.filter((pin) => !hidden.has(pin.layerId)),
          ]
        : [],
    [content, hidden],
  );
  const zones = useMemo(
    () => content?.zones.filter((zone) => !hidden.has(zone.layerId)) ?? [],
    [content, hidden],
  );

  if (map.isError) {
    return <p className="text-sm text-muted-foreground">{t("blocks.map.missing")}</p>;
  }
  if (!map.data || !content) return null;

  return (
    <>
      <div className="flex items-center gap-2">
        <MapIcon aria-hidden className="size-4 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{map.data.title}</span>
        {link && (
          <Button asChild variant="secondary" size="xs">
            <Link {...link}>
              <ExternalLink />
              {t("blocks.map.open")}
            </Link>
          </Button>
        )}
        <Button variant="ghost" size="xs" onClick={onChange}>
          <RefreshCw />
          {t("blocks.map.change")}
        </Button>
      </div>
      <div className="h-80 overflow-hidden rounded-lg">
        <MapView
          ref={view}
          readOnly
          backgroundAssetId={map.data.backgroundAssetId}
          tiles={map.data.tiled ? { mapId: map.data.id } : null}
          width={map.data.width}
          height={map.data.height}
          label={t("maps.viewLabel", { name: map.data.title })}
          markers={markers}
          zones={zones}
          markerLabel={(id) => {
            const pin = content.pins.find((other) => other.id === id);
            const text = content.texts.find((other) => other.id === id);
            return pin?.label || text?.text || "";
          }}
          renderMarker={(id, zoomScale) => {
            const text = content.texts.find((other) => other.id === id);
            if (text) return <MapTextView text={text} zoomScale={zoomScale} selected={false} />;
            const pin = content.pins.find((other) => other.id === id);
            if (!pin) return null;
            const Icon = typeIcon(pin.icon);
            return (
              <div
                aria-hidden
                className="absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-background text-white shadow"
                style={{ backgroundColor: typeColor(pin.color) }}
              >
                <Icon className="size-3.5" />
              </div>
            );
          }}
        />
      </div>
    </>
  );
}
