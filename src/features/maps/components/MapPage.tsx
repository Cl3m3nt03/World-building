import { useParams } from "@tanstack/react-router";
import { ImageOff, Maximize } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMarkOpened } from "@/features/cards/hooks/useCards";
import type { Map as WorldMap } from "@/lib/bindings";
import { usePendingSave } from "@/lib/pendingSaves";
import { useMapEditor } from "../hooks/useMapEditor";
import { useMap, useRenameMap } from "../hooks/useMaps";
import { LayersPanel } from "./LayersPanel";
import { MapView, type MapViewHandle } from "./MapView";

/** Delay before a typed title is saved. */
const SAVE_DELAY_MS = 500;

function TitleField({ map }: { map: WorldMap }) {
  const { t } = useTranslation();
  const rename = useRenameMap(map.id);
  const [title, setTitle] = useState(map.title);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const id = useId();

  useEffect(() => setTitle(map.title), [map.title]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const save = (value: string) => {
    clearTimeout(timer.current);
    const trimmed = value.trim();
    if (trimmed === "" || trimmed === map.title) return undefined;
    // A failure is shown under the title (`rename.error`).
    return rename.mutateAsync(trimmed).catch(() => {});
  };
  usePendingSave(() => save(title));

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <label htmlFor={id} className="sr-only">
        {t("maps.title")}
      </label>
      <Input
        id={id}
        value={title}
        maxLength={200}
        aria-invalid={title.trim() === ""}
        onChange={(event) => {
          const value = event.target.value;
          setTitle(value);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => save(value), SAVE_DELAY_MS);
        }}
        onBlur={() => void save(title)}
        onKeyDown={(event) => {
          if (event.key === "Enter") void save(title);
        }}
        className="h-auto border-transparent bg-transparent px-1 py-0.5 font-heading text-xl font-bold shadow-none hover:border-border focus-visible:border-ring md:text-xl dark:bg-transparent"
      />
      {rename.isError && <AppErrorMessage error={rename.error} />}
    </div>
  );
}

/** A map, opened in the World tab: its name and the map itself (M4). */
export function MapPage() {
  const { mapId } = useParams({ from: "/world/$worldId/world/map/$mapId" });
  const map = useMap(mapId);
  useMarkOpened(mapId);

  if (map.isError) {
    return (
      <div className="p-6">
        <AppErrorMessage error={map.error} />
      </div>
    );
  }
  if (!map.data) return null;
  // Remounted for another map: the editor starts from that map's content.
  return <MapEditor key={map.data.id} map={map.data} />;
}

function MapEditor({ map }: { map: WorldMap }) {
  const { t } = useTranslation();
  const view = useRef<MapViewHandle>(null);
  const editor = useMapEditor(map);
  const data = map;

  return (
    <article aria-label={data.title} className="glass flex h-full flex-col gap-3 rounded-lg p-3">
      <header className="flex items-center gap-2">
        <TitleField map={data} />
        <Button variant="secondary" size="sm" onClick={() => view.current?.recenter()}>
          <Maximize />
          {t("maps.recenter")}
        </Button>
      </header>
      {data.backgroundAssetId === null && (
        <p role="alert" className="flex items-center gap-2 text-sm text-muted-foreground">
          <ImageOff aria-hidden className="size-4" />
          {t("maps.noBackground")}
        </p>
      )}
      {editor.saveError && (
        <p role="alert" className="text-sm text-destructive">
          {t("maps.saveError")}
        </p>
      )}
      <div className="flex min-h-0 flex-1 gap-3">
        <div className="min-w-0 flex-1">
          <MapView
            ref={view}
            backgroundAssetId={data.backgroundAssetId}
            width={data.width}
            height={data.height}
            label={t("maps.viewLabel", { name: data.title })}
          />
        </div>
        <aside className="w-56 shrink-0 overflow-y-auto">
          <LayersPanel
            content={editor.content}
            update={editor.update}
            activeLayerId={editor.activeLayerId}
            onActiveLayerChange={editor.setActiveLayerId}
          />
        </aside>
      </div>
      <p className="text-xs text-muted-foreground">{t("maps.navigationHint")}</p>
    </article>
  );
}
