import "leaflet/dist/leaflet.css";
import L from "leaflet";
import {
  forwardRef,
  type ReactNode,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { assetUrl } from "@/lib/assets";
import type { MapPin, MapZone } from "@/lib/bindings";
import { CARD_DROP_EVENT, type CardDropDetail } from "@/lib/cardDrop";
import type { Point } from "../zones";
import { type ZoneHandlers, ZoneLayers, ZoneTrace } from "./zoneLayers";

export type MapViewHandle = {
  /** Fits the whole image in the view. */
  recenter: () => void;
  /** The point of the image at the centre of the view (relative, 0 to 1). */
  center: () => { x: number; y: number };
};

/** A point of the image (relative, 0 to 1) and where it is on the screen. */
export type MapPoint = { x: number; y: number; clientX: number; clientY: number };

type MapViewProps = {
  /** Background image, or null when it was deleted from the media library. */
  backgroundAssetId: string | null;
  width: number;
  height: number;
  /** Accessible name of the map area. */
  label: string;
  /** Pins to show (those of visible layers). */
  pins?: MapPin[];
  /** What a pin looks like, rendered into its marker. */
  renderPin?: (pin: MapPin) => ReactNode;
  /** Accessible name of a pin. */
  pinLabel?: (pin: MapPin) => string;
  onPinMove?: (id: string, x: number, y: number) => void;
  onPinClick?: (id: string) => void;
  onPinOpen?: (id: string) => void;
  /** A key pressed on a focused pin (arrows, Enter, Delete…). */
  onPinKey?: (id: string, event: KeyboardEvent) => void;
  onContextMenu?: (point: MapPoint) => void;
  onCardDrop?: (cardId: string, x: number, y: number) => void;
  /** Zones to show (those of visible layers), the selected one with its handles. */
  zones?: MapZone[];
  selectedZoneId?: string | null;
  zoneLabel?: (zone: MapZone) => string;
  zoneHandlers?: ZoneHandlers;
  /** The zone being traced (Zone tool), or null. */
  trace?: Point[] | null;
  /** A click on the map while tracing: a new vertex. */
  onTraceClick?: (x: number, y: number) => void;
  /** The first vertex clicked again: the shape closes. */
  onTraceClose?: () => void;
};

/** Bounds of an image of `width` × `height` px: y goes down, as on screen. */
export function imageBounds(width: number, height: number): L.LatLngBoundsExpression {
  return [
    [-height, 0],
    [0, width],
  ];
}

/**
 * The map's image in Leaflet with a flat coordinate system (`CRS.Simple`,
 * ADR 0001): wheel or touchpad to zoom, drag or middle button to move;
 * focused, the arrows move and + / - zoom (Leaflet's keyboard handler).
 * Pins are Leaflet markers (draggable, focusable) whose content React
 * renders through portals. Positions given and reported are relative to
 * the image (0 to 1).
 */
export const MapView = forwardRef<MapViewHandle, MapViewProps>(function MapView(
  {
    backgroundAssetId,
    width,
    height,
    label,
    pins = [],
    renderPin,
    pinLabel,
    onPinMove,
    onPinClick,
    onPinOpen,
    onPinKey,
    onContextMenu,
    onCardDrop,
    zones = [],
    selectedZoneId = null,
    zoneLabel = (zone) => zone.label,
    zoneHandlers = {},
    trace = null,
    onTraceClick,
    onTraceClose,
  },
  ref,
) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const overlay = useRef<L.ImageOverlay | null>(null);
  const markers = useRef(new Map<string, L.Marker>());
  // Elements of the markers, where React renders each pin.
  const [pinElements, setPinElements] = useState<ReadonlyMap<string, HTMLElement>>(new Map());
  // The latest callbacks and size, for the Leaflet handlers bound once.
  const latest = {
    onPinMove,
    onPinClick,
    onPinOpen,
    onPinKey,
    onContextMenu,
    onCardDrop,
    zoneHandlers,
    onTraceClick,
    onTraceClose,
  };
  const handlers = useRef(latest);
  handlers.current = latest;
  const zoneLayers = useRef<ZoneLayers | null>(null);
  const zoneTrace = useRef<ZoneTrace | null>(null);
  const tracing = useRef(trace);
  tracing.current = trace;
  const pointer = useRef<L.LatLng | null>(null);
  const size = useRef({ width, height });
  size.current = { width, height };

  const toRelative = (latlng: L.LatLng) => ({
    x: latlng.lng / size.current.width,
    y: -latlng.lat / size.current.height,
  });
  const toLatLng = (x: number, y: number) =>
    L.latLng(-y * size.current.height, x * size.current.width);
  const onImage = (point: { x: number; y: number }) =>
    point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1;

  useImperativeHandle(ref, () => ({
    recenter: () => map.current?.fitBounds(imageBounds(width, height), { animate: true }),
    center: () => {
      const center = map.current?.getCenter();
      if (!center) return { x: 0.5, y: 0.5 };
      const point = toRelative(center);
      return { x: Math.min(1, Math.max(0, point.x)), y: Math.min(1, Math.max(0, point.y)) };
    },
  }));

  // The Leaflet map lives as long as the component; its handlers read the
  // latest props through refs.
  // biome-ignore lint/correctness/useExhaustiveDependencies: bound once, see above
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const created = L.map(element, {
      crs: L.CRS.Simple,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      wheelPxPerZoomLevel: 120,
      attributionControl: false,
      zoomControl: false,
      keyboardPanDelta: 120,
    });
    map.current = created;
    zoneLayers.current = new ZoneLayers(
      created,
      toLatLng,
      toRelative,
      () => handlers.current.zoneHandlers,
    );
    created.on("click", (event: L.LeafletMouseEvent) => {
      if (!tracing.current) return;
      const point = toRelative(event.latlng);
      if (onImage(point)) handlers.current.onTraceClick?.(point.x, point.y);
    });
    created.on("mousemove", (event: L.LeafletMouseEvent) => {
      pointer.current = event.latlng;
      if (tracing.current) zoneTrace.current?.update(tracing.current, event.latlng);
    });
    created.on("contextmenu", (event: L.LeafletMouseEvent) => {
      const point = toRelative(event.latlng);
      if (!onImage(point)) return;
      handlers.current.onContextMenu?.({
        ...point,
        clientX: event.originalEvent.clientX,
        clientY: event.originalEvent.clientY,
      });
    });
    // The middle button drags too (Leaflet only drags with the left one).
    const onMiddleDown = (event: MouseEvent) => {
      if (event.button === 1) event.preventDefault();
    };
    element.addEventListener("mousedown", onMiddleDown);
    // A card of the sidebar dropped on the map (DocumentTreeView).
    const onDrop = (event: Event) => {
      const { cardId, clientX, clientY } = (event as CustomEvent<CardDropDetail>).detail;
      const box = element.getBoundingClientRect();
      if (clientX < box.left || clientX > box.right || clientY < box.top || clientY > box.bottom) {
        return;
      }
      const point = toRelative(
        created.containerPointToLatLng([clientX - box.left, clientY - box.top]),
      );
      if (onImage(point)) handlers.current.onCardDrop?.(cardId, point.x, point.y);
    };
    window.addEventListener(CARD_DROP_EVENT, onDrop);
    const ownMarkers = markers.current;
    return () => {
      window.removeEventListener(CARD_DROP_EVENT, onDrop);
      element.removeEventListener("mousedown", onMiddleDown);
      ownMarkers.clear();
      zoneLayers.current?.remove();
      zoneLayers.current = null;
      zoneTrace.current?.remove();
      zoneTrace.current = null;
      created.remove();
      map.current = null;
      overlay.current = null;
    };
  }, []);

  // The image and the bounds follow the background.
  useEffect(() => {
    const current = map.current;
    if (!current) return;
    const bounds = imageBounds(width, height);
    overlay.current?.remove();
    overlay.current = backgroundAssetId
      ? L.imageOverlay(assetUrl(backgroundAssetId), bounds).addTo(current)
      : null;
    current.setMaxBounds(L.latLngBounds(bounds as L.LatLngBoundsLiteral).pad(0.5));
    current.fitBounds(bounds);
    current.setMinZoom(current.getZoom() - 1);
    current.setMaxZoom(current.getZoom() + 6);
  }, [backgroundAssetId, width, height]);

  // One Leaflet marker per pin, kept in step with the pins.
  // biome-ignore lint/correctness/useExhaustiveDependencies: toLatLng reads the size through a ref
  useEffect(() => {
    const current = map.current;
    if (!current) return;
    const known = markers.current;
    let changed = false;
    for (const pin of pins) {
      const position = toLatLng(pin.x ?? 0, pin.y ?? 0);
      const existing = known.get(pin.id);
      if (existing) {
        if (!existing.getLatLng().equals(position)) existing.setLatLng(position);
        if (pinLabel) existing.getElement()?.setAttribute("aria-label", pinLabel(pin));
        continue;
      }
      const marker = L.marker(position, {
        icon: L.divIcon({ className: "bz-map-pin", html: "", iconSize: undefined }),
        draggable: true,
        keyboard: true,
        autoPan: true,
      }).addTo(current);
      marker.on("dragend", () => {
        const point = toRelative(marker.getLatLng());
        handlers.current.onPinMove?.(pin.id, point.x, point.y);
      });
      marker.on("click", () => handlers.current.onPinClick?.(pin.id));
      marker.on("dblclick", () => handlers.current.onPinOpen?.(pin.id));
      if (pinLabel) marker.getElement()?.setAttribute("aria-label", pinLabel(pin));
      marker.getElement()?.addEventListener("keydown", (event) => {
        // The map's own arrow keys must not move the view meanwhile.
        event.stopPropagation();
        handlers.current.onPinKey?.(pin.id, event);
      });
      known.set(pin.id, marker);
      changed = true;
    }
    const ids = new Set(pins.map((pin) => pin.id));
    for (const [id, marker] of known) {
      if (!ids.has(id)) {
        marker.remove();
        known.delete(id);
        changed = true;
      }
    }
    if (changed) {
      setPinElements(
        new Map(
          [...known].flatMap(([id, marker]) => {
            const element = marker.getElement();
            return element ? [[id, element] as const] : [];
          }),
        ),
      );
    }
  }, [pins]);

  // The zones, kept in step.
  useEffect(() => {
    zoneLayers.current?.sync(zones, selectedZoneId, zoneLabel);
  }, [zones, selectedZoneId, zoneLabel]);

  // The zone being traced, with its line to the pointer.
  // biome-ignore lint/correctness/useExhaustiveDependencies: toLatLng reads the size through a ref
  useEffect(() => {
    const current = map.current;
    if (!current) return;
    if (!trace) {
      zoneTrace.current?.remove();
      zoneTrace.current = null;
      current.getContainer().style.cursor = "";
      return;
    }
    zoneTrace.current ??= new ZoneTrace(current, toLatLng, () => handlers.current.onTraceClose?.());
    zoneTrace.current.update(trace, pointer.current);
    current.getContainer().style.cursor = "crosshair";
  }, [trace]);

  // Leaflet measures its container: tell it when the layout changes.
  useEffect(() => {
    if (!container.current || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => map.current?.invalidateSize());
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div
        ref={container}
        role="application"
        aria-label={label}
        className="size-full rounded-lg bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      {renderPin &&
        pins.map((pin) => {
          const element = pinElements.get(pin.id);
          return element ? createPortal(renderPin(pin), element, pin.id) : null;
        })}
    </>
  );
});
