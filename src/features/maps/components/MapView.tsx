import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { assetUrl } from "@/lib/assets";

export type MapViewHandle = {
  /** Fits the whole image in the view. */
  recenter: () => void;
};

type MapViewProps = {
  /** Background image, or null when it was deleted from the media library. */
  backgroundAssetId: string | null;
  width: number;
  height: number;
  /** Accessible name of the map area. */
  label: string;
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
 */
export const MapView = forwardRef<MapViewHandle, MapViewProps>(function MapView(
  { backgroundAssetId, width, height, label },
  ref,
) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const overlay = useRef<L.ImageOverlay | null>(null);
  useImperativeHandle(ref, () => ({
    recenter: () => map.current?.fitBounds(imageBounds(width, height), { animate: true }),
  }));

  // The Leaflet map lives as long as the component.
  useEffect(() => {
    if (!container.current) return;
    const created = L.map(container.current, {
      crs: L.CRS.Simple,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      wheelPxPerZoomLevel: 120,
      attributionControl: false,
      zoomControl: false,
      keyboardPanDelta: 120,
    });
    map.current = created;
    // The middle button drags too (Leaflet only drags with the left one).
    const onMiddleDown = (event: MouseEvent) => {
      if (event.button === 1) event.preventDefault();
    };
    container.current.addEventListener("mousedown", onMiddleDown);
    const element = container.current;
    return () => {
      element.removeEventListener("mousedown", onMiddleDown);
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

  // Leaflet measures its container: tell it when the layout changes.
  useEffect(() => {
    if (!container.current || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => map.current?.invalidateSize());
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={container}
      role="application"
      aria-label={label}
      className="size-full rounded-lg bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    />
  );
});
