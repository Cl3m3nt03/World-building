import { useNavigate, useParams } from "@tanstack/react-router";
import {
  Image as ImageIcon,
  ImageOff,
  MapPinPlus,
  Maximize,
  Pentagon,
  Redo2,
  SquareUser,
  Type as TypeIcon,
  Undo2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { DocumentTitleField } from "@/components/DocumentTitleField";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCardTypes } from "@/features/card-types";
import { CardPicker, useCardList } from "@/features/cards";
import { useMarkOpened } from "@/features/cards/hooks/useCards";
import { ImagePickerDialog } from "@/features/media";
import type { MapPin, MapZone, Map as WorldMap } from "@/lib/bindings";
import { useMapEditor } from "../hooks/useMapEditor";
import { useMap, useRenameMap, useSetMapBackground } from "../hooks/useMaps";
import { hiddenLayers } from "../layers";
import { addPin, KEYBOARD_STEP, newPin, nudgePin, removePin, updatePin } from "../pins";
import { addText, newText, removeText, updateText } from "../texts";
import {
  addZone,
  insertVertex,
  MIN_VERTICES,
  moveVertex,
  newZone,
  type Point,
  removeVertex,
  removeZone,
  updateZone,
} from "../zones";
import { LayersPanel } from "./LayersPanel";
import { MapTextView } from "./MapTextView";
import { type MapPoint, MapView, type MapViewHandle } from "./MapView";
import { PinMarker } from "./PinMarker";
import { PinPanel } from "./PinPanel";
import { PreparingMapDialog } from "./PreparingMapDialog";
import { TextPanel } from "./TextPanel";
import { ZonePanel } from "./ZonePanel";

/** Delay before a typed title is saved. */
function TitleField({ map }: { map: WorldMap }) {
  const { t } = useTranslation();
  const rename = useRenameMap(map.id);
  return <DocumentTitleField title={map.title} label={t("maps.title")} rename={rename} />;
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

/**
 * Undo group of a change made in a properties panel: the same field of the
 * same item (typing, dragging a slider) makes one step.
 */
function fieldGroup(id: string, patch: object): string {
  return `${id}:${Object.keys(patch).sort().join(",")}`;
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
  const [selectedId, setSelectedPin] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZone] = useState<string | null>(null);
  // The zone being traced with the Zone tool (its vertices), or null.
  const [trace, setTrace] = useState<Point[] | null>(null);
  const [selectedTextId, setSelectedText] = useState<string | null>(null);
  // The Text tool: the next click on the map places a text.
  const [placingText, setPlacingText] = useState(false);
  // A text just placed: its field takes the focus.
  const [newTextId, setNewTextId] = useState<string | null>(null);
  const setSelectedId = (id: string | null) => {
    setSelectedPin(id);
    setSelectedZone(null);
    setSelectedText(null);
  };
  const selectZone = (id: string | null) => {
    setSelectedZone(id);
    setSelectedPin(null);
    setSelectedText(null);
  };
  const selectText = (id: string | null) => {
    setSelectedText(id);
    setSelectedPin(null);
    setSelectedZone(null);
  };
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const [pickingCard, setPickingCard] = useState(false);
  const [pickingBackground, setPickingBackground] = useState(false);
  const setBackground = useSetMapBackground(map.id);
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
  const visibleTexts = useMemo(
    () => content.texts.filter((text) => !hidden.has(text.layerId)),
    [content.texts, hidden],
  );
  const selectedText = content.texts.find((text) => text.id === selectedTextId);
  // Texts under the pins.
  const markers = useMemo(() => [...visibleTexts, ...visiblePins], [visibleTexts, visiblePins]);
  const textOf = (id: string) => content.texts.find((text) => text.id === id);
  const placeText = (x: number, y: number) => {
    const text = newText(activeLayerId, x, y, t("maps.texts.new"));
    update((previous) => addText(previous, text));
    setPlacingText(false);
    selectText(text.id);
    setNewTextId(text.id);
  };
  // Ctrl+Z / Ctrl+Y (or Ctrl+Shift+Z) in the map; text fields keep their own.
  const historyKeys = useRef({ undo: editor.undo, redo: editor.redo });
  historyKeys.current = { undo: editor.undo, redo: editor.redo };
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        historyKeys.current.undo();
      } else if (key === "y" || (key === "z" && event.shiftKey)) {
        event.preventDefault();
        historyKeys.current.redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Escape gives up placing a text.
  useEffect(() => {
    if (!placingText) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setPlacingText(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [placingText]);
  const onTextKey = (id: string, event: KeyboardEvent) => {
    const steps: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const step = steps[event.key];
    const text = textOf(id);
    if (step && text) {
      event.preventDefault();
      const factor = (event.shiftKey ? 5 : 1) * KEYBOARD_STEP;
      update((previous) =>
        updateText(previous, id, {
          x: (text.x ?? 0) + step[0] * factor,
          y: (text.y ?? 0) + step[1] * factor,
        }),
      );
      selectText(id);
    } else if (event.key === "Enter") {
      event.preventDefault();
      selectText(id);
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      update((previous) => removeText(previous, id));
      selectText(null);
    } else if (event.key === "Escape") {
      selectText(null);
    }
  };
  const visibleZones = useMemo(
    () => content.zones.filter((zone) => !hidden.has(zone.layerId)),
    [content.zones, hidden],
  );
  const selectedZone = content.zones.find((zone) => zone.id === selectedZoneId);
  const closeTrace = () => {
    if (!trace || trace.length < MIN_VERTICES) return;
    const zone = newZone(activeLayerId, trace);
    update((previous) => addZone(previous, zone));
    setTrace(null);
    selectZone(zone.id);
  };
  const closeTraceRef = useRef(closeTrace);
  closeTraceRef.current = closeTrace;
  const tracingNow = trace !== null;
  // While tracing: Escape cancels, Backspace removes the last vertex, Enter closes.
  useEffect(() => {
    if (!tracingNow) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setTrace(null);
      } else if (event.key === "Backspace") {
        event.preventDefault();
        setTrace((points) => (points ? points.slice(0, -1) : points));
      } else if (event.key === "Enter") {
        event.preventDefault();
        closeTraceRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tracingNow]);
  const zoneHandlers = useMemo(
    () => ({
      onZoneClick: (id: string) => {
        setSelectedZone(id);
        setSelectedPin(null);
      },
      onVertexMove: (id: string, index: number, x: number, y: number) =>
        update((previous) => moveVertex(previous, id, index, [x, y])),
      onVertexInsert: (id: string, index: number, x: number, y: number) =>
        update((previous) => insertVertex(previous, id, index, [x, y])),
      onVertexRemove: (id: string, index: number) =>
        update((previous) => removeVertex(previous, id, index)),
    }),
    [update],
  );
  const zoneLabel = (zone: MapZone) =>
    t("maps.zones.ariaLabel", { name: zone.label || t("maps.pins.unnamed") });
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
        <Button
          variant="secondary"
          size="sm"
          aria-pressed={placingText}
          onClick={() => {
            setPlacingText((current) => !current);
            setTrace(null);
          }}
        >
          <TypeIcon />
          {t("maps.texts.tool")}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          aria-pressed={trace !== null}
          onClick={() => {
            setTrace((current) => (current === null ? [] : null));
            setPlacingText(false);
            setSelectedId(null);
          }}
        >
          <Pentagon />
          {t("maps.zones.tool")}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("maps.history.undo")}
          aria-keyshortcuts="Control+Z"
          title={t("maps.history.undo")}
          disabled={!editor.canUndo}
          onClick={editor.undo}
        >
          <Undo2 />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("maps.history.redo")}
          aria-keyshortcuts="Control+Y"
          title={t("maps.history.redo")}
          disabled={!editor.canRedo}
          onClick={editor.redo}
        >
          <Redo2 />
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setPickingBackground(true)}>
          <ImageIcon />
          {t("maps.background.button")}
        </Button>
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
      {placingText && (
        <p role="status" className="text-sm text-muted-foreground">
          {t("maps.texts.placing")}
        </p>
      )}
      {trace !== null && (
        <p role="status" className="text-sm text-muted-foreground">
          {t("maps.zones.tracing", { count: trace.length })}
        </p>
      )}
      {setBackground.isError && <AppErrorMessage error={setBackground.error} />}
      <ImagePickerDialog
        open={pickingBackground}
        onOpenChange={setPickingBackground}
        title={t("maps.background.pickerTitle")}
        selectedId={data.backgroundAssetId}
        onPick={(assetId) => setBackground.mutate(assetId)}
      />
      <PreparingMapDialog pending={setBackground.isPending} />
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
            tiles={data.tiled ? { mapId: data.id } : null}
            width={data.width}
            height={data.height}
            label={t("maps.viewLabel", { name: data.title })}
            markers={markers}
            markerLabel={(id) => {
              const pin = content.pins.find((other) => other.id === id);
              if (pin) return pinLabel(pin);
              const text = textOf(id);
              return text ? t("maps.texts.ariaLabel", { text: text.text }) : "";
            }}
            renderMarker={(id, zoomScale) => {
              const text = textOf(id);
              if (text) {
                return (
                  <MapTextView text={text} zoomScale={zoomScale} selected={id === selectedTextId} />
                );
              }
              const pin = content.pins.find((other) => other.id === id);
              if (!pin) return null;
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
            onPlace={placingText ? placeText : null}
            onMarkerMove={(id, x, y) => {
              if (textOf(id)) {
                update((previous) => updateText(previous, id, { x, y }));
                selectText(id);
                return;
              }
              update((previous) => updatePin(previous, id, { x, y }));
              setSelectedId(id);
            }}
            onMarkerClick={(id) => (textOf(id) ? selectText(id) : setSelectedId(id))}
            onMarkerOpen={(id) => openCard(content.pins.find((pin) => pin.id === id))}
            onMarkerKey={(id, event) => (textOf(id) ? onTextKey(id, event) : onPinKey(id, event))}
            onContextMenu={(point) => setMenu({ ...point, pickCard: false })}
            onCardDrop={(cardId, x, y) => place(x, y, cardId)}
            zones={visibleZones}
            selectedZoneId={selectedZoneId}
            zoneLabel={zoneLabel}
            zoneHandlers={zoneHandlers}
            trace={trace}
            onTraceClick={(x, y) => setTrace((points) => [...(points ?? []), [x, y]])}
            onTraceClose={() => closeTraceRef.current()}
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
        <aside className="flex w-60 shrink-0 flex-col gap-3 overflow-x-hidden overflow-y-auto">
          <LayersPanel
            content={content}
            update={update}
            activeLayerId={activeLayerId}
            onActiveLayerChange={editor.setActiveLayerId}
          />
          {selectedText && (
            <TextPanel
              key={selectedText.id}
              text={selectedText}
              layers={content.layers}
              autoFocus={selectedText.id === newTextId}
              onChange={(patch) =>
                update(
                  (previous) => updateText(previous, selectedText.id, patch),
                  fieldGroup(selectedText.id, patch),
                )
              }
              onDelete={() => {
                update((previous) => removeText(previous, selectedText.id));
                selectText(null);
              }}
            />
          )}
          {selectedZone && (
            <ZonePanel
              key={selectedZone.id}
              zone={selectedZone}
              card={selectedZone.cardId ? cardsById.get(selectedZone.cardId) : undefined}
              layers={content.layers}
              onChange={(patch) =>
                update(
                  (previous) => updateZone(previous, selectedZone.id, patch),
                  fieldGroup(selectedZone.id, patch),
                )
              }
              onDelete={() => {
                update((previous) => removeZone(previous, selectedZone.id));
                selectZone(null);
              }}
            />
          )}
          {selected && (
            <PinPanel
              key={selected.id}
              pin={selected}
              card={cardOf(selected)}
              layers={content.layers}
              onChange={(patch) =>
                update(
                  (previous) => updatePin(previous, selected.id, patch),
                  fieldGroup(selected.id, patch),
                )
              }
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
