import { useNavigate, useParams } from "@tanstack/react-router";
import { ImageOff, MapPinPlus, Maximize, SquareUser } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useCardTypes } from "@/features/card-types";
import { CardPicker, useCardList } from "@/features/cards";
import { useMarkOpened } from "@/features/cards/hooks/useCards";
import type { MapPin, Map as WorldMap } from "@/lib/bindings";
import { usePendingSave } from "@/lib/pendingSaves";
import { useMapEditor } from "../hooks/useMapEditor";
import { useMap, useRenameMap } from "../hooks/useMaps";
import { hiddenLayers } from "../layers";
import { addPin, newPin, nudgePin, removePin, updatePin } from "../pins";
import { LayersPanel } from "./LayersPanel";
import { type MapPoint, MapView, type MapViewHandle } from "./MapView";
import { PinMarker } from "./PinMarker";
import { PinPanel } from "./PinPanel";

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

/** The map's right-click menu, at the point clicked. */
type ContextMenuState = MapPoint & { pickCard: boolean };

function MapEditor({ map }: { map: WorldMap }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { worldId } = useParams({ from: "/world/$worldId" });
  const view = useRef<MapViewHandle>(null);
  const editor = useMapEditor(map);
  const { content, update, activeLayerId } = editor;
  const cards = useCardList(false);
  const types = useCardTypes();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const [pickingCard, setPickingCard] = useState(false);
  const data = map;

  const cardsById = useMemo(
    () => new Map((cards.data ?? []).map((card) => [card.id, card])),
    [cards.data],
  );
  const typesById = useMemo(
    () => new Map((types.data ?? []).map((type) => [type.id, type])),
    [types.data],
  );
  const hidden = useMemo(() => hiddenLayers(content), [content]);
  const visiblePins = useMemo(
    () => content.pins.filter((pin) => !hidden.has(pin.layerId)),
    [content.pins, hidden],
  );
  const selected = content.pins.find((pin) => pin.id === selectedId);
  const cardOf = (pin: MapPin) => (pin.cardId ? cardsById.get(pin.cardId) : undefined);

  const place = (x: number, y: number, cardId: string | null) => {
    const card = cardId ? cardsById.get(cardId) : undefined;
    const pin = newPin(activeLayerId, x, y, cardId, card ? "" : t("maps.pins.newLabel"));
    update((previous) => addPin(previous, pin));
    setSelectedId(pin.id);
  };
  const openCard = (pin: MapPin | undefined) => {
    if (pin?.cardId && cardsById.has(pin.cardId)) {
      void navigate({
        to: "/world/$worldId/world/card/$cardId",
        params: { worldId, cardId: pin.cardId },
      });
    }
  };
  const remove = (id: string) => {
    update((previous) => removePin(previous, id));
    setSelectedId(null);
  };
  const onPinKey = (id: string, event: KeyboardEvent) => {
    const steps: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const step = steps[event.key];
    if (step) {
      event.preventDefault();
      const factor = event.shiftKey ? 5 : 1;
      update((previous) => nudgePin(previous, id, step[0] * factor, step[1] * factor));
      setSelectedId(id);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (selectedId === id) openCard(content.pins.find((pin) => pin.id === id));
      else setSelectedId(id);
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      remove(id);
    } else if (event.key === "Escape") {
      setSelectedId(null);
    }
  };
  const pinLabel = (pin: MapPin) => {
    const card = cardOf(pin);
    return card
      ? t("maps.pins.cardLabel", { name: card.title })
      : t("maps.pins.markerLabel", { name: pin.label || t("maps.pins.unnamed") });
  };

  return (
    <article aria-label={data.title} className="glass flex h-full flex-col gap-3 rounded-lg p-3">
      <header className="flex flex-wrap items-center gap-2">
        <TitleField map={data} />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            const center = view.current?.center() ?? { x: 0.5, y: 0.5 };
            place(center.x, center.y, null);
          }}
        >
          <MapPinPlus />
          {t("maps.pins.add")}
        </Button>
        <CardPicker
          label={t("maps.pins.searchCard")}
          allowedTypeIds={[]}
          open={pickingCard && menu === null}
          onOpenChange={setPickingCard}
          onPick={(cardId) => {
            const center = view.current?.center() ?? { x: 0.5, y: 0.5 };
            place(center.x, center.y, cardId);
          }}
        >
          <Button variant="secondary" size="sm">
            <SquareUser />
            {t("maps.pins.addCard")}
          </Button>
        </CardPicker>
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
        <div className="relative min-w-0 flex-1">
          <MapView
            ref={view}
            backgroundAssetId={data.backgroundAssetId}
            width={data.width}
            height={data.height}
            label={t("maps.viewLabel", { name: data.title })}
            pins={visiblePins}
            pinLabel={pinLabel}
            renderPin={(pin) => {
              const card = cardOf(pin);
              return (
                <PinMarker
                  pin={pin}
                  card={card}
                  type={card?.typeId ? typesById.get(card.typeId) : undefined}
                  selected={pin.id === selectedId}
                />
              );
            }}
            onPinMove={(id, x, y) => {
              update((previous) => updatePin(previous, id, { x, y }));
              setSelectedId(id);
            }}
            onPinClick={setSelectedId}
            onPinOpen={(id) => openCard(content.pins.find((pin) => pin.id === id))}
            onPinKey={onPinKey}
            onContextMenu={(point) => setMenu({ ...point, pickCard: false })}
            onCardDrop={(cardId, x, y) => place(x, y, cardId)}
          />
          <PointMenu
            menu={menu}
            onClose={() => setMenu(null)}
            onAddPin={(point) => place(point.x, point.y, null)}
            onAddCard={(point, cardId) => place(point.x, point.y, cardId)}
            onPickCard={() =>
              setMenu((current) => (current ? { ...current, pickCard: true } : null))
            }
          />
        </div>
        <aside className="flex w-60 shrink-0 flex-col gap-3 overflow-y-auto">
          <LayersPanel
            content={content}
            update={update}
            activeLayerId={activeLayerId}
            onActiveLayerChange={editor.setActiveLayerId}
          />
          {selected && (
            <PinPanel
              key={selected.id}
              pin={selected}
              card={cardOf(selected)}
              layers={content.layers}
              onChange={(patch) => update((previous) => updatePin(previous, selected.id, patch))}
              onDelete={() => remove(selected.id)}
            />
          )}
        </aside>
      </div>
      <p className="text-xs text-muted-foreground">{t("maps.navigationHint")}</p>
    </article>
  );
}

/**
 * The right-click menu of the map, opened at the point clicked: add a
 * plain pin there, or a card (picked in a search) there.
 */
function PointMenu({
  menu,
  onClose,
  onAddPin,
  onAddCard,
  onPickCard,
}: {
  menu: ContextMenuState | null;
  onClose: () => void;
  onAddPin: (point: MapPoint) => void;
  onAddCard: (point: MapPoint, cardId: string) => void;
  onPickCard: () => void;
}) {
  const { t } = useTranslation();
  if (!menu) return null;
  // An invisible anchor at the point clicked, for the menu and the search.
  const anchor = (
    <span aria-hidden className="fixed size-0" style={{ left: menu.clientX, top: menu.clientY }} />
  );
  if (menu.pickCard) {
    return (
      <CardPicker
        label={t("maps.pins.searchCard")}
        allowedTypeIds={[]}
        open
        onOpenChange={(open) => !open && onClose()}
        onPick={(cardId) => {
          onAddCard(menu, cardId);
          onClose();
        }}
      >
        {anchor}
      </CardPicker>
    );
  }
  return (
    <DropdownMenu open onOpenChange={(open) => !open && onClose()}>
      <DropdownMenuTrigger asChild>{anchor}</DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem
          onSelect={() => {
            onAddPin(menu);
            onClose();
          }}
        >
          <MapPinPlus />
          {t("maps.pins.addHere")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            onPickCard();
          }}
        >
          <SquareUser />
          {t("maps.pins.addCardHere")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
