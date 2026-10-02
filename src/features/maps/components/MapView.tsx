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
import type { MapZone } from "@/lib/bindings";
import { CARD_DROP_EVENT, type CardDropDetail } from "@/lib/cardDrop";
import type { Point } from "../zones";
import { type ZoneHandlers, ZoneLayers, ZoneTrace } from "./zoneLayers";

export type MapViewHandle = {
  /** Fits the whole image in the view. */
  recenter: () => void;
  /** The point of the image at the centre of the view (relative, 0 to 1). */
  center: () => { x: number; y: number };
};

/** Something shown at a point of the map: a pin or a text (M4 4.5, 4.7). */
export type MapMarker = { id: string; x: number | null; y: number | null };

/** A point of the image (relative, 0 to 1) and where it is on the screen. */
export type MapPoint = { x: number; y: number; clientX: number; clientY: number };

type MapViewProps = {
  /** Background image, or null when it was deleted from the media library. */
  backgroundAssetId: string | null;
  width: number;
  height: number;
  /** Accessible name of the map area. */
  label: string;
  /** Pins and texts to show (those of visible layers), drawn in this order. */
  markers?: MapMarker[];
  /**
   * What a marker looks like, rendered into it; `zoomScale` is 1 at the
   * zoom that fits the image, ×2 one level in.
   */
  renderMarker?: (id: string, zoomScale: number) => ReactNode;
  /** Accessible name of a marker. */
  markerLabel?: (id: string) => string;
  onMarkerMove?: (id: string, x: number, y: number) => void;
  onMarkerClick?: (id: string) => void;
  onMarkerOpen?: (id: string) => void;
  /** A key pressed on a focused marker (arrows, Enter, Delete…). */
  onMarkerKey?: (id: string, event: KeyboardEvent) => void;
  /** A click on the map places something (Text tool): where. */
  onPlace?: ((x: number, y: number) => void) | null;
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
  /**
   * Shown in a card (M4 4.10): nothing moves, the wheel scrolls the page
   * (zoom with + / -).
   */
  readOnly?: boolean;
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
    markers: items = [],
    renderMarker,
    markerLabel,
    onMarkerMove,
    onMarkerClick,
    onMarkerOpen,
    onMarkerKey,
    onPlace = null,
    onContextMenu,
    onCardDrop,
    zones = [],
    selectedZoneId = null,
    zoneLabel = (zone) => zone.label,
    zoneHandlers = {},
    trace = null,
    onTraceClick,
    onTraceClose,
    readOnly = false,
  },
  ref,
) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const overlay = useRef<L.ImageOverlay | null>(null);
  const markers = useRef(new Map<string, L.Marker>());
  // Elements of the markers, where React renders each pin or text.
  const [markerElements, setMarkerElements] = useState<ReadonlyMap<string, HTMLElement>>(new Map());
  // Zoom relative to the zoom fitting the image, for texts that follow it.
  const [zoomScale, setZoomScale] = useState(1);
  const fitZoom = useRef(0);
  // The latest callbacks and size, for the Leaflet handlers bound once.
  const latest = {
    onMarkerMove,
    onMarkerClick,
    onMarkerOpen,
    onMarkerKey,
    onPlace,
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
      scrollWheelZoom: !readOnly,
    });
    map.current = created;
    zoneLayers.current = new ZoneLayers(
      created,
      toLatLng,
      toRelative,
      () => handlers.current.zoneHandlers,
    );
    created.on("click", (event: L.LeafletMouseEvent) => {
      const point = toRelative(event.latlng);
      if (!onImage(point)) return;
      if (tracing.current) handlers.current.onTraceClick?.(point.x, point.y);
      else handlers.current.onPlace?.(point.x, point.y);
    });
    created.on("zoomend", () => setZoomScale(2 ** (created.getZoom() - fitZoom.current)));
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
    fitZoom.current = current.getZoom();
    setZoomScale(1);
    current.setMinZoom(current.getZoom() - 1);
    current.setMaxZoom(current.getZoom() + 6);
  }, [backgroundAssetId, width, height]);

  // One Leaflet marker per pin or text, kept in step with them.
  // biome-ignore lint/correctness/useExhaustiveDependencies: toLatLng reads the size through a ref
  useEffect(() => {
    const current = map.current;
    if (!current) return;
    const known = markers.current;
    let changed = false;
    for (const item of items) {
      const position = toLatLng(item.x ?? 0, item.y ?? 0);
      const existing = known.get(item.id);
      if (existing) {
        if (!existing.getLatLng().equals(position)) existing.setLatLng(position);
        if (markerLabel) existing.getElement()?.setAttribute("aria-label", markerLabel(item.id));
        continue;
      }
      const marker = L.marker(position, {
        icon: L.divIcon({ className: "bz-map-pin", html: "", iconSize: undefined }),
        draggable: !readOnly,
        keyboard: !readOnly,
        autoPan: !readOnly,
      }).addTo(current);
      const id = item.id;
      marker.on("dragend", () => {
        const point = toRelative(marker.getLatLng());
        handlers.current.onMarkerMove?.(id, point.x, point.y);
      });
      marker.on("click", () => handlers.current.onMarkerClick?.(id));
      marker.on("dblclick", () => handlers.current.onMarkerOpen?.(id));
      if (markerLabel) marker.getElement()?.setAttribute("aria-label", markerLabel(id));
      marker.getElement()?.addEventListener("keydown", (event) => {
        // The map's own arrow keys must not move the view meanwhile.
        event.stopPropagation();
        handlers.current.onMarkerKey?.(id, event);
      });
      known.set(id, marker);
      changed = true;
    }
    const ids = new Set(items.map((item) => item.id));
    for (const [id, marker] of known) {
      if (!ids.has(id)) {
        marker.remove();
        known.delete(id);
        changed = true;
      }
    }
    if (changed) {
      setMarkerElements(
        new Map(
          [...known].flatMap(([id, marker]) => {
            const element = marker.getElement();
            return element ? [[id, element] as const] : [];
          }),
        ),
      );
    }
  }, [items]);

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

  // A crosshair while a click places something.
  useEffect(() => {
    const current = map.current;
    if (current && !trace) current.getContainer().style.cursor = onPlace ? "crosshair" : "";
  }, [onPlace, trace]);

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
      {renderMarker &&
        items.map((item) => {
          const element = markerElements.get(item.id);
          return element ? createPortal(renderMarker(item.id, zoomScale), element, item.id) : null;
        })}
    </>
  );
});
