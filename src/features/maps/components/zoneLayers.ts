import L from "leaflet";
import { typeColor } from "@/features/card-types";
import type { MapZone, ZonePattern } from "@/lib/bindings";
import { centroid, edgeMiddles, type Point } from "../zones";

/**
 * Leaflet drawing of the zones (M4 step 4.6): SVG polygons filled with a
 * colour or a pattern, a label at their centre, and for the selected zone
 * handles to move, add and remove vertices. Kept out of MapView, which
 * calls `syncZones` when the zones change.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

/** The `<defs>` holding the fill patterns, in a hidden SVG of the page. */
function patternDefs(): SVGDefsElement {
  const existing = document.getElementById("bz-map-patterns");
  if (existing?.firstElementChild instanceof SVGDefsElement) return existing.firstElementChild;
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("id", "bz-map-patterns");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.style.position = "absolute";
  const defs = document.createElementNS(SVG_NS, "defs");
  svg.appendChild(defs);
  document.body.appendChild(svg);
  return defs;
}

/** Id of the fill pattern `pattern` in `color`, created on first use. */
function patternId(pattern: Exclude<ZonePattern, "solid">, color: string): string {
  const id = `bz-pattern-${pattern}-${color}`;
  if (document.getElementById(id)) return id;
  const element = document.createElementNS(SVG_NS, "pattern");
  element.setAttribute("id", id);
  element.setAttribute("patternUnits", "userSpaceOnUse");
  element.setAttribute("width", "10");
  element.setAttribute("height", "10");
  const shape = (name: string, attributes: Record<string, string>) => {
    const child = document.createElementNS(SVG_NS, name);
    for (const [key, value] of Object.entries(attributes)) child.setAttribute(key, value);
    child.style.stroke = typeColor(color);
    child.style.fill = typeColor(color);
    element.appendChild(child);
  };
  if (pattern === "hatch" || pattern === "cross") {
    shape("path", { d: "M-1,1 l2,-2 M0,10 l10,-10 M9,11 l2,-2", "stroke-width": "1.5" });
  }
  if (pattern === "cross") {
    shape("path", { d: "M-1,9 l2,2 M0,0 l10,10 M9,-1 l2,2", "stroke-width": "1.5" });
  }
  if (pattern === "dots") shape("circle", { cx: "5", cy: "5", r: "1.6" });
  patternDefs().appendChild(element);
  return id;
}

/** Paints a zone's polygon: fill (colour or pattern), opacity, outline. */
function paint(polygon: L.Polygon, zone: MapZone, selected: boolean) {
  const path = polygon.getElement() as SVGPathElement | undefined;
  if (!path) return;
  const color = typeColor(zone.fillColor);
  path.style.stroke = color;
  path.style.strokeWidth = selected ? "3" : "2";
  path.style.strokeDasharray = selected ? "6 4" : "";
  path.style.fillOpacity = String(zone.opacity ?? 0.35);
  path.style.fill =
    zone.pattern === "solid" ? color : `url(#${patternId(zone.pattern, zone.fillColor)})`;
}

export type ZoneHandlers = {
  onZoneClick?: (id: string) => void;
  onVertexMove?: (id: string, index: number, x: number, y: number) => void;
  onVertexInsert?: (id: string, index: number, x: number, y: number) => void;
  onVertexRemove?: (id: string, index: number) => void;
};

type Drawn = { zone: MapZone; polygon: L.Polygon; label: L.Tooltip | null };

/** Draws the zones of a map, kept in step with each call. */
export class ZoneLayers {
  private drawn = new Map<string, Drawn>();
  private handles: L.Layer[] = [];

  constructor(
    private map: L.Map,
    private toLatLng: (x: number, y: number) => L.LatLng,
    private toRelative: (latlng: L.LatLng) => { x: number; y: number },
    private handlers: () => ZoneHandlers,
  ) {}

  private latlngs(points: Point[]) {
    return points.map(([x, y]) => this.toLatLng(x, y));
  }

  sync(zones: MapZone[], selectedId: string | null, labelOf: (zone: MapZone) => string) {
    const ids = new Set(zones.map((zone) => zone.id));
    for (const [id, drawn] of this.drawn) {
      if (!ids.has(id)) {
        drawn.polygon.remove();
        this.drawn.delete(id);
      }
    }
    for (const zone of zones) {
      let drawn = this.drawn.get(zone.id);
      if (!drawn) {
        const polygon = L.polygon(this.latlngs(zone.points as Point[]), {
          interactive: true,
          bubblingMouseEvents: false,
        }).addTo(this.map);
        polygon.on("click", () => this.handlers().onZoneClick?.(zone.id));
        drawn = { zone, polygon, label: null };
        this.drawn.set(zone.id, drawn);
      } else if (drawn.zone.points !== zone.points) {
        drawn.polygon.setLatLngs(this.latlngs(zone.points as Point[]));
      }
      drawn.zone = zone;
      paint(drawn.polygon, zone, zone.id === selectedId);
      const text = labelOf(zone);
      drawn.polygon.getElement()?.setAttribute("aria-label", text);
      drawn.polygon.unbindTooltip();
      drawn.label = null;
      if (zone.label) {
        const content = document.createElement("span");
        content.textContent = zone.label;
        content.style.fontFamily = zone.labelStyle.font;
        content.style.fontSize = `${zone.labelStyle.size ?? 18}px`;
        const [cx, cy] = centroid(zone.points as Point[]);
        drawn.polygon.bindTooltip(content, {
          permanent: true,
          direction: "center",
          className: "bz-zone-label",
        });
        drawn.polygon.openTooltip(this.toLatLng(cx, cy));
        drawn.label = drawn.polygon.getTooltip() ?? null;
      }
    }
    this.syncHandles(zones.find((zone) => zone.id === selectedId) ?? null);
  }

  /** Handles of the selected zone: vertices (drag, right click removes) and edge middles (click adds). */
  private syncHandles(zone: MapZone | null) {
    for (const handle of this.handles) handle.remove();
    this.handles = [];
    if (!zone) return;
    const points = zone.points as Point[];
    points.forEach(([x, y], index) => {
      const vertex = L.marker(this.toLatLng(x, y), {
        icon: L.divIcon({ className: "bz-map-vertex", iconSize: [12, 12] }),
        draggable: true,
        keyboard: false,
      }).addTo(this.map);
      vertex.on("dragend", () => {
        const point = this.toRelative(vertex.getLatLng());
        this.handlers().onVertexMove?.(zone.id, index, point.x, point.y);
      });
      vertex.on("contextmenu", (event: L.LeafletMouseEvent) => {
        L.DomEvent.stop(event.originalEvent);
        this.handlers().onVertexRemove?.(zone.id, index);
      });
      this.handles.push(vertex);
    });
    edgeMiddles(points).forEach(([x, y], index) => {
      const middle = L.circleMarker(this.toLatLng(x, y), {
        radius: 4,
        className: "bz-map-edge-middle",
        bubblingMouseEvents: false,
      }).addTo(this.map);
      middle.on("click", () => this.handlers().onVertexInsert?.(zone.id, index, x, y));
      this.handles.push(middle);
    });
  }

  remove() {
    for (const drawn of this.drawn.values()) drawn.polygon.remove();
    for (const handle of this.handles) handle.remove();
    this.drawn.clear();
    this.handles = [];
  }
}

/**
 * The zone being traced: its vertices, a dashed line to the pointer, and
 * the first vertex, lit when hovered, which closes the shape on a click.
 */
export class ZoneTrace {
  private line: L.Polyline;
  private preview: L.Polyline;
  private first: L.CircleMarker | null = null;

  constructor(
    private map: L.Map,
    private toLatLng: (x: number, y: number) => L.LatLng,
    private onClose: () => void,
  ) {
    this.line = L.polyline([], { className: "bz-map-trace", interactive: false }).addTo(map);
    this.preview = L.polyline([], {
      className: "bz-map-trace",
      dashArray: "6 6",
      interactive: false,
    }).addTo(map);
  }

  update(points: Point[], pointer: L.LatLng | null) {
    const latlngs = points.map(([x, y]) => this.toLatLng(x, y));
    this.line.setLatLngs(latlngs);
    const last = latlngs.at(-1);
    this.preview.setLatLngs(last && pointer ? [last, pointer] : []);
    const start = latlngs[0];
    if (!start) {
      this.first?.remove();
      this.first = null;
      return;
    }
    if (!this.first) {
      this.first = L.circleMarker(start, {
        radius: 7,
        className: "bz-map-trace-start",
        bubblingMouseEvents: false,
      }).addTo(this.map);
      this.first.on("mouseover", () => this.first?.getElement()?.classList.add("bz-ready"));
      this.first.on("mouseout", () => this.first?.getElement()?.classList.remove("bz-ready"));
      this.first.on("click", () => this.onClose());
    } else {
      this.first.setLatLng(start);
    }
    // Closing needs 3 vertices.
    this.first.getElement()?.classList.toggle("bz-closable", points.length >= 3);
  }

  remove() {
    this.line.remove();
    this.preview.remove();
    this.first?.remove();
  }
}
