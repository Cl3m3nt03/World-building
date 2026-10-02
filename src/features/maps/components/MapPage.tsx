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
import { useMap, useRenameMap } from "../hooks/useMaps";
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
  const { t } = useTranslation();
  const { mapId } = useParams({ from: "/world/$worldId/world/map/$mapId" });
  const map = useMap(mapId);
  useMarkOpened(mapId);
  const view = useRef<MapViewHandle>(null);

  if (map.isError) {
    return (
      <div className="p-6">
        <AppErrorMessage error={map.error} />
      </div>
    );
  }
  if (!map.data) return null;

  return (
    <article
      aria-label={map.data.title}
      className="glass flex h-full flex-col gap-3 rounded-lg p-3"
    >
      <header className="flex items-center gap-2">
        <TitleField map={map.data} />
        <Button variant="secondary" size="sm" onClick={() => view.current?.recenter()}>
          <Maximize />
          {t("maps.recenter")}
        </Button>
      </header>
      {map.data.backgroundAssetId === null && (
        <p role="alert" className="flex items-center gap-2 text-sm text-muted-foreground">
          <ImageOff aria-hidden className="size-4" />
          {t("maps.noBackground")}
        </p>
      )}
      <div className="min-h-0 flex-1">
        <MapView
          ref={view}
          backgroundAssetId={map.data.backgroundAssetId}
          width={map.data.width}
          height={map.data.height}
          label={t("maps.viewLabel", { name: map.data.title })}
        />
      </div>
      <p className="text-xs text-muted-foreground">{t("maps.navigationHint")}</p>
    </article>
  );
}
