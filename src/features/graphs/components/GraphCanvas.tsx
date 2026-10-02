import { ArrowUpRight, Pin, PinOff } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { assetUrl } from "@/lib/assets";
import type { CardType, GraphEdge, GraphNode, GraphViewport } from "@/lib/bindings";
import type { Settings } from "../settings";
import type { SimLinkInput, SimNodeInput } from "../simulation";
import { useSimulation } from "../useSimulation";

/** Radius of a node at size 1, in graph units (and px at zoom 1). */
export const NODE_RADIUS = 14;
const MIN_ZOOM = 0.02;
const MAX_ZOOM = 8;
/** Arrows move the view this far, in px. */
const KEY_PAN = 60;
const FIT_PADDING = 48;
/** Side of the cached thumbnails of the cards' images, in px. */
const THUMBNAIL_SIZE = 96;
/** Beyond this many nodes, names show only once zoomed in. */
const LABELS_ALWAYS_UNDER = 300;
/** Beyond this many nodes in view, no name is drawn (zoom in to read them). */
const MAX_LABELS = 400;

/** View: a point of the graph (x, y) is drawn at (x * k + tx, y * k + ty). */
type Transform = { tx: number; ty: number; k: number };

export type GraphCanvasHandle = {
  /** Frames every node. */
  recenter: () => void;
  /** Moves the view so that the node `id` is at the centre. */
  centerOn: (id: string) => void;
  /** Where the node `id` is now, in graph coordinates. */
  positionOf: (id: string) => [number, number] | null;
};

type Props = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  typesById: ReadonlyMap<string, CardType>;
  settings: Settings;
  /** Accessible name of the drawing ("Graph X: 12 cards, 20 links"). */
  label: string;
  /** The selected card: it and its neighbours stand out, the rest fades. */
  selectedId: string | null;
  /** Cards to make stand out when none is selected (search results). */
  highlighted?: ReadonlySet<string> | null;
  onSelect: (id: string | null) => void;
  /** Double click, or Enter on the selected node: opens the card. */
  onOpen: (id: string) => void;
  /** Pinned nodes and where they stay. */
  pinned: ReadonlyMap<string, readonly [number, number]>;
  /** Right click › Pin / Unpin. */
  onTogglePin: (id: string) => void;
  /** A pinned node dropped elsewhere: it stays pinned there. */
  onPinnedMove: (id: string, x: number, y: number) => void;
  /** The framing saved with the graph; `null`: frame every node. */
  initialViewport: GraphViewport | null;
  /** The view was moved (or framed again: `null`). */
  onViewChange: (viewport: GraphViewport | null) => void;
};

/** Value of a CSS variable of the theme, or `fallback`. */
function cssVar(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/** The colour of a card type, resolved from its theme variable. */
function typeFill(type: CardType | undefined): string {
  return cssVar(`--bz-type-${type?.color ?? "slate"}`, "#64748b");
}

/**
 * The graph drawn on a canvas (docs/features/04-graph.md): no DOM element per
 * node or edge, so that thousands stay fluid. The force simulation runs in a
 * Web Worker; the view moves with the mouse (drag, wheel) and the keyboard
 * (arrows, + and -).
 */
export const GraphCanvas = forwardRef<GraphCanvasHandle, Props>(function GraphCanvas(
  {
    nodes,
    edges,
    typesById,
    settings,
    label,
    selectedId,
    highlighted = null,
    onSelect,
    onOpen,
    pinned,
    onTogglePin,
    onPinnedMove,
    initialViewport,
    onViewChange,
  },
  ref,
) {
  const { t } = useTranslation();
  // The node a right click was made on (its menu).
  const [menuNode, setMenuNode] = useState<string | null>(null);
  const pinnedRef = useRef(pinned);
  pinnedRef.current = pinned;
  const container = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const transform = useRef<Transform>({ tx: 0, ty: 0, k: 1 });
  // Until the view is moved by hand, it keeps framing the whole graph; a
  // saved framing is applied once the canvas has its size.
  const autoFit = useRef(initialViewport === null);
  const savedView = useRef(initialViewport);
  const frame = useRef<number | null>(null);
  const images = useRef(new Map<string, HTMLCanvasElement | "loading" | "failed">());
  // Where each node was last drawn: a filter that changes the nodes keeps
  // the others in place instead of laying everything out again.
  const lastPositions = useRef(new Map<string, [number, number]>());

  const simNodes = useMemo<SimNodeInput[]>(
    () =>
      nodes.map((node) => {
        const last = lastPositions.current.get(node.id);
        const fixed = pinnedRef.current.get(node.id);
        return {
          id: node.id,
          radius: NODE_RADIUS,
          ...(last ? { x: last[0], y: last[1] } : {}),
          ...(fixed ? { fx: fixed[0], fy: fixed[1] } : {}),
        };
      }),
    [nodes],
  );
  const simLinks = useMemo<SimLinkInput[]>(
    () => edges.map((edge) => ({ source: edge.source, target: edge.target, weight: edge.weight })),
    [edges],
  );
  const indexOf = useMemo(() => new Map(nodes.map((node, index) => [node.id, index])), [nodes]);
  // Each edge as (source index, target index, weight), to draw without lookups.
  const edgeEnds = useMemo(() => {
    const ends = new Int32Array(edges.length * 3);
    edges.forEach((edge, index) => {
      ends[index * 3] = indexOf.get(edge.source) ?? 2 ** 30;
      ends[index * 3 + 1] = indexOf.get(edge.target) ?? 2 ** 30;
      ends[index * 3 + 2] = edge.weight;
    });
    return ends;
  }, [edges, indexOf]);
  const neighbours = useMemo(() => {
    const byId = new Map<string, Set<string>>();
    for (const edge of edges) {
      for (const [a, b] of [
        [edge.source, edge.target],
        [edge.target, edge.source],
      ] as const) {
        const set = byId.get(a) ?? new Set<string>();
        set.add(b);
        byId.set(a, set);
      }
    }
    return byId;
  }, [edges]);
  // What stands out: the selected card and its neighbours, else the
  // highlighted cards, else everything.
  const focus = useMemo<ReadonlySet<string> | null>(() => {
    if (selectedId) return new Set([selectedId, ...(neighbours.get(selectedId) ?? [])]);
    return highlighted;
  }, [selectedId, neighbours, highlighted]);

  const draw = () => {
    frame.current = null;
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!element || !context) return;
    const ratio = window.devicePixelRatio || 1;
    const width = element.clientWidth;
    const height = element.clientHeight;
    if (
      element.width !== Math.round(width * ratio) ||
      element.height !== Math.round(height * ratio)
    ) {
      element.width = Math.round(width * ratio);
      element.height = Math.round(height * ratio);
    }
    const positions = simulation.positions.current;
    if (positions.length === nodes.length * 2) {
      nodes.forEach((node, index) => {
        lastPositions.current.set(node.id, [
          positions[index * 2] as number,
          positions[index * 2 + 1] as number,
        ]);
      });
    }
    const saved = savedView.current;
    if (saved && width > 0 && height > 0) {
      savedView.current = null;
      const k = saved.zoom ?? 1;
      transform.current = {
        k,
        tx: width / 2 - (saved.x ?? 0) * k,
        ty: height / 2 - (saved.y ?? 0) * k,
      };
    }
    if (autoFit.current) frameAll(width, height);
    const { tx, ty, k } = transform.current;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.setTransform(ratio * k, 0, 0, ratio * k, ratio * tx, ratio * ty);

    const radius = NODE_RADIUS * settings.nodeSize;
    // What is in view, in graph coordinates (with a node's margin): the rest
    // is not drawn.
    const margin = radius + 40 / k;
    const left = -tx / k - margin;
    const top = -ty / k - margin;
    const right = (width - tx) / k + margin;
    const bottom = (height - ty) / k + margin;
    const inView = (x: number, y: number) => x >= left && x <= right && y >= top && y <= bottom;
    const count = Math.min(nodes.length, positions.length / 2);
    const lit = (id: string) => !focus || focus.has(id);

    // Edges, in a few strokes: one per thickness and brightness.
    const edgeColor = cssVar("--muted-foreground", "#888");
    const buckets = new Map<string, number[]>();
    for (let index = 0; index < edgeEnds.length; index += 3) {
      const a = edgeEnds[index] as number;
      const b = edgeEnds[index + 1] as number;
      if (a >= count || b >= count) continue;
      const ax = positions[a * 2] as number;
      const ay = positions[a * 2 + 1] as number;
      const bx = positions[b * 2] as number;
      const by = positions[b * 2 + 1] as number;
      // Off screen when both ends are on the same outer side.
      if ((ax < left && bx < left) || (ax > right && bx > right)) continue;
      if ((ay < top && by < top) || (ay > bottom && by > bottom)) continue;
      const edge = edges[index / 3] as GraphEdge;
      const key = `${Math.min(4, edgeEnds[index + 2] as number)}:${lit(edge.source) && lit(edge.target) ? 1 : 0}`;
      const list = buckets.get(key) ?? [];
      list.push(ax, ay, bx, by);
      buckets.set(key, list);
    }
    context.strokeStyle = edgeColor;
    for (const [key, lines] of buckets) {
      const [weight, bright] = key.split(":").map(Number) as [number, number];
      context.globalAlpha = bright ? 0.45 : 0.06;
      context.lineWidth = (1 + Math.log2(weight)) / k ** 0.5;
      context.beginPath();
      for (let index = 0; index < lines.length; index += 4) {
        context.moveTo(lines[index] as number, lines[index + 1] as number);
        context.lineTo(lines[index + 2] as number, lines[index + 3] as number);
      }
      context.stroke();
    }
    context.globalAlpha = 1;

    // Nodes: the card's image, or its type's colour (and its initial when
    // large enough). Plain nodes are filled per colour, in one path each.
    const background = cssVar("--background", "#fff");
    const foreground = cssVar("--foreground", "#000");
    const primary = cssVar("--primary", "#b07a2a");
    const fills = new Map<string, string>();
    const fillOf = (typeId: string | null) => {
      const key = typeId ?? "";
      let fill = fills.get(key);
      if (!fill) {
        fill = typeFill(typeId ? typesById.get(typeId) : undefined);
        fills.set(key, fill);
      }
      return fill;
    };
    const visible: number[] = [];
    for (let index = 0; index < count; index++) {
      if (inView(positions[index * 2] as number, positions[index * 2 + 1] as number)) {
        visible.push(index);
      }
    }
    const initials = k * radius >= 10;
    for (const bright of [false, true]) {
      if (bright === false && !focus) continue;
      context.globalAlpha = bright ? 1 : 0.18;
      const plain = new Map<string, number[]>();
      for (const index of visible) {
        const node = nodes[index] as GraphNode;
        if (lit(node.id) !== bright) continue;
        const x = positions[index * 2] as number;
        const y = positions[index * 2 + 1] as number;
        const image = node.imageAssetId ? loadImage(node.imageAssetId) : null;
        if (image) {
          context.save();
          context.beginPath();
          context.arc(x, y, radius, 0, Math.PI * 2);
          context.clip();
          context.drawImage(image, x - radius, y - radius, radius * 2, radius * 2);
          context.restore();
        } else {
          const fill = fillOf(node.typeId);
          const list = plain.get(fill) ?? [];
          list.push(index);
          plain.set(fill, list);
        }
      }
      for (const [fill, list] of plain) {
        context.fillStyle = fill;
        context.beginPath();
        for (const index of list) {
          const x = positions[index * 2] as number;
          const y = positions[index * 2 + 1] as number;
          context.moveTo(x + radius, y);
          context.arc(x, y, radius, 0, Math.PI * 2);
        }
        context.fill();
        if (initials) {
          context.fillStyle = background;
          context.font = `600 ${radius}px sans-serif`;
          context.textAlign = "center";
          context.textBaseline = "middle";
          for (const index of list) {
            const node = nodes[index] as GraphNode;
            context.fillText(
              node.title.slice(0, 1).toUpperCase(),
              positions[index * 2] as number,
              (positions[index * 2 + 1] as number) + radius * 0.05,
            );
          }
        }
      }
      // A thin outline in the background colour, all at once.
      context.lineWidth = 1.5 / k;
      context.strokeStyle = background;
      context.beginPath();
      for (const index of visible) {
        if (lit((nodes[index] as GraphNode).id) !== bright) continue;
        const x = positions[index * 2] as number;
        const y = positions[index * 2 + 1] as number;
        context.moveTo(x + radius, y);
        context.arc(x, y, radius, 0, Math.PI * 2);
      }
      context.stroke();
    }
    context.globalAlpha = 1;

    // The selected node's ring and the pinned nodes' dots.
    const selectedIndex = selectedId ? indexOf.get(selectedId) : undefined;
    if (selectedIndex !== undefined && selectedIndex < count) {
      context.lineWidth = 3 / k;
      context.strokeStyle = primary;
      context.beginPath();
      context.arc(
        positions[selectedIndex * 2] as number,
        positions[selectedIndex * 2 + 1] as number,
        radius + 1.5 / k,
        0,
        Math.PI * 2,
      );
      context.stroke();
    }
    for (const id of pinned.keys()) {
      const index = indexOf.get(id);
      if (index === undefined || index >= count) continue;
      const x = positions[index * 2] as number;
      const y = positions[index * 2 + 1] as number;
      if (!inView(x, y)) continue;
      context.globalAlpha = lit(id) ? 1 : 0.18;
      context.beginPath();
      context.arc(
        x + radius * 0.75,
        y - radius * 0.75,
        Math.max(3 / k, radius * 0.28),
        0,
        Math.PI * 2,
      );
      context.fillStyle = primary;
      context.fill();
      context.lineWidth = 1.5 / k;
      context.strokeStyle = background;
      context.stroke();
    }
    context.globalAlpha = 1;

    // Names under the nodes: with many nodes, only once zoomed in enough to
    // read them and with few enough in view (docs/features/04-graph.md,
    // « Performance »).
    const labelZoom = nodes.length > LABELS_ALWAYS_UNDER ? 14 : 6;
    if (settings.showLabels && k * radius > labelZoom && visible.length <= MAX_LABELS) {
      context.fillStyle = foreground;
      context.font = `${12 / k}px sans-serif`;
      context.textAlign = "center";
      context.textBaseline = "top";
      context.lineWidth = 3 / k;
      context.strokeStyle = background;
      for (const index of visible) {
        const node = nodes[index] as GraphNode;
        const x = positions[index * 2] as number;
        const y = (positions[index * 2 + 1] as number) + radius + 3 / k;
        context.globalAlpha = lit(node.id) ? 1 : 0.18;
        context.strokeText(node.title, x, y);
        context.fillText(node.title, x, y);
      }
      context.globalAlpha = 1;
    }
  };

  const redraw = () => {
    if (frame.current === null) frame.current = requestAnimationFrame(draw);
  };

  const simulation = useSimulation({ nodes: simNodes, links: simLinks, settings, onTick: redraw });

  /**
   * The card's image as a small square thumbnail (cropped at its centre),
   * made once: drawing thousands of them stays cheap.
   */
  function loadImage(assetId: string): HTMLCanvasElement | null {
    const cached = images.current.get(assetId);
    if (cached instanceof HTMLCanvasElement) return cached;
    if (cached) return null;
    images.current.set(assetId, "loading");
    const image = new Image();
    image.onload = () => {
      const thumbnail = document.createElement("canvas");
      thumbnail.width = THUMBNAIL_SIZE;
      thumbnail.height = THUMBNAIL_SIZE;
      const side = Math.min(image.naturalWidth, image.naturalHeight);
      thumbnail
        .getContext("2d")
        ?.drawImage(
          image,
          (image.naturalWidth - side) / 2,
          (image.naturalHeight - side) / 2,
          side,
          side,
          0,
          0,
          THUMBNAIL_SIZE,
          THUMBNAIL_SIZE,
        );
      images.current.set(assetId, thumbnail);
      redraw();
    };
    image.onerror = () => images.current.set(assetId, "failed");
    image.src = assetUrl(assetId);
    return null;
  }

  /** Frames every node in a `width` × `height` view. */
  function frameAll(width: number, height: number) {
    const positions = simulation.positions.current;
    if (positions.length < 2 || width === 0 || height === 0) return;
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (let index = 0; index < positions.length; index += 2) {
      const x = positions[index] as number;
      const y = positions[index + 1] as number;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    const radius = NODE_RADIUS * settings.nodeSize;
    const spanX = maxX - minX + radius * 2;
    const spanY = maxY - minY + radius * 2 + 20;
    const k = Math.min(
      MAX_ZOOM / 4,
      Math.max(
        MIN_ZOOM,
        Math.min((width - FIT_PADDING * 2) / spanX, (height - FIT_PADDING * 2) / spanY),
      ),
    );
    transform.current = {
      k,
      tx: width / 2 - ((minX + maxX) / 2) * k,
      ty: height / 2 - ((minY + maxY) / 2) * k,
    };
  }

  /** Tells where the view now is: the graph point at its centre, and the zoom. */
  function reportView() {
    const element = canvas.current;
    if (!element) return;
    const { tx, ty, k } = transform.current;
    onViewChange({
      x: (element.clientWidth / 2 - tx) / k,
      y: (element.clientHeight / 2 - ty) / k,
      zoom: k,
    });
  }

  /** Zooms by `factor` around the screen point (sx, sy). */
  function zoomAt(factor: number, sx: number, sy: number) {
    autoFit.current = false;
    const { tx, ty, k } = transform.current;
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, k * factor));
    transform.current = {
      k: next,
      tx: sx - ((sx - tx) / k) * next,
      ty: sy - ((sy - ty) / k) * next,
    };
    redraw();
    reportView();
  }

  function panBy(dx: number, dy: number) {
    autoFit.current = false;
    const { tx, ty, k } = transform.current;
    transform.current = { k, tx: tx + dx, ty: ty + dy };
    redraw();
    reportView();
  }

  /** Graph coordinates of the screen point (sx, sy), relative to the canvas. */
  function toGraph(sx: number, sy: number): [number, number] {
    const { tx, ty, k } = transform.current;
    return [(sx - tx) / k, (sy - ty) / k];
  }

  /** The node under the screen point (sx, sy), the one drawn on top first. */
  function nodeAt(sx: number, sy: number): string | null {
    const [gx, gy] = toGraph(sx, sy);
    const positions = simulation.positions.current;
    const reach = NODE_RADIUS * settings.nodeSize + 3 / transform.current.k;
    for (let index = nodes.length - 1; index >= 0; index--) {
      const x = positions[index * 2];
      const y = positions[index * 2 + 1];
      if (x === undefined || y === undefined) continue;
      if (Math.hypot(x - gx, y - gy) <= reach) return nodes[index]?.id ?? null;
    }
    return null;
  }

  useImperativeHandle(ref, () => ({
    recenter: () => {
      autoFit.current = true;
      savedView.current = null;
      redraw();
      onViewChange(null);
    },
    positionOf: (id) => {
      const index = indexOf.get(id);
      const positions = simulation.positions.current;
      if (index === undefined || index * 2 + 1 >= positions.length) return null;
      return [positions[index * 2] as number, positions[index * 2 + 1] as number];
    },
    centerOn: (id) => {
      const index = indexOf.get(id);
      const element = canvas.current;
      const positions = simulation.positions.current;
      if (index === undefined || !element || index * 2 + 1 >= positions.length) return;
      autoFit.current = false;
      const k = Math.max(transform.current.k, 0.8);
      transform.current = {
        k,
        tx: element.clientWidth / 2 - (positions[index * 2] as number) * k,
        ty: element.clientHeight / 2 - (positions[index * 2 + 1] as number) * k,
      };
      redraw();
      reportView();
    },
  }));

  // The theme, the settings or the data changed: draw again.
  // biome-ignore lint/correctness/useExhaustiveDependencies: redraw reads the latest values
  useEffect(() => {
    redraw();
  }, [nodes, edges, settings, typesById, focus, selectedId, pinned]);

  // Pinned or freed from the menu or the list: the simulation follows.
  const sentPins = useRef(pinned);
  // biome-ignore lint/correctness/useExhaustiveDependencies: simulation.send reads a ref
  useEffect(() => {
    const before = sentPins.current;
    sentPins.current = pinned;
    for (const [id, [x, y]] of pinned) {
      const old = before.get(id);
      if (!old || old[0] !== x || old[1] !== y) simulation.send({ type: "fix", id, x, y });
    }
    for (const id of before.keys()) {
      if (!pinned.has(id)) simulation.send({ type: "fix", id, x: null, y: null });
    }
  }, [pinned]);

  // The canvas follows the size of its container.
  // biome-ignore lint/correctness/useExhaustiveDependencies: bound once
  useEffect(() => {
    const element = container.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => redraw());
    observer.observe(element);
    return () => {
      observer.disconnect();
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, []);

  // Wheel zoom: a native listener, to prevent the page from scrolling.
  // biome-ignore lint/correctness/useExhaustiveDependencies: bound once, reads refs
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const box = element.getBoundingClientRect();
      zoomAt(2 ** (-event.deltaY / 300), event.clientX - box.left, event.clientY - box.top);
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, []);

  // What the pointer holds: the view (to move it) or a node (to drag it).
  const dragging = useRef<
    | { kind: "view"; x: number; y: number; moved: boolean }
    | { kind: "node"; id: string; x: number; y: number; moved: boolean; at?: [number, number] }
    | null
  >(null);
  const local = (event: { clientX: number; clientY: number }): [number, number] => {
    const box = canvas.current?.getBoundingClientRect();
    return [event.clientX - (box?.left ?? 0), event.clientY - (box?.top ?? 0)];
  };

  return (
    <div ref={container} className="relative size-full overflow-hidden rounded-lg bg-muted">
      <ContextMenu onOpenChange={(open) => !open && setMenuNode(null)}>
        <ContextMenuTrigger asChild>
          <canvas
            ref={canvas}
            onContextMenu={(event) => {
              // A menu only on a node.
              const id = nodeAt(...local(event));
              if (!id) {
                event.preventDefault();
                return;
              }
              setMenuNode(id);
            }}
            role="img"
            aria-label={label}
            tabIndex={0}
            className="size-full cursor-grab outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
            onPointerDown={(event) => {
              if (event.button !== 0 && event.button !== 1) return;
              event.currentTarget.setPointerCapture?.(event.pointerId);
              const [sx, sy] = local(event);
              const id = event.button === 0 ? nodeAt(sx, sy) : null;
              dragging.current = id
                ? { kind: "node", id, x: event.clientX, y: event.clientY, moved: false }
                : { kind: "view", x: event.clientX, y: event.clientY, moved: false };
            }}
            onPointerMove={(event) => {
              const held = dragging.current;
              if (!held) {
                const [sx, sy] = local(event);
                event.currentTarget.style.cursor = nodeAt(sx, sy) ? "pointer" : "";
                return;
              }
              const moved =
                held.moved || Math.hypot(event.clientX - held.x, event.clientY - held.y) > 3;
              if (!moved) return;
              if (held.kind === "view") {
                panBy(event.clientX - held.x, event.clientY - held.y);
                dragging.current = { ...held, x: event.clientX, y: event.clientY, moved };
              } else {
                const [gx, gy] = toGraph(...local(event));
                simulation.send({ type: "drag", id: held.id, x: gx, y: gy });
                dragging.current = { ...held, moved, at: [gx, gy] };
              }
            }}
            onPointerUp={() => {
              const held = dragging.current;
              dragging.current = null;
              if (!held) return;
              if (held.kind === "node") {
                if (!held.moved) onSelect(held.id);
                else if (held.at && pinned.has(held.id))
                  onPinnedMove(held.id, held.at[0], held.at[1]);
                else simulation.send({ type: "drag", id: held.id, x: null, y: null });
              } else if (!held.moved) {
                onSelect(null);
              }
            }}
            onDoubleClick={(event) => {
              const id = nodeAt(...local(event));
              if (id) onOpen(id);
            }}
            onKeyDown={(event) => {
              const element = event.currentTarget;
              const steps: Record<string, [number, number]> = {
                ArrowLeft: [KEY_PAN, 0],
                ArrowRight: [-KEY_PAN, 0],
                ArrowUp: [0, KEY_PAN],
                ArrowDown: [0, -KEY_PAN],
              };
              const step = steps[event.key];
              if (step) {
                event.preventDefault();
                panBy(step[0], step[1]);
              } else if (event.key === "+" || event.key === "=") {
                event.preventDefault();
                zoomAt(1.25, element.clientWidth / 2, element.clientHeight / 2);
              } else if (event.key === "Enter" && selectedId) {
                event.preventDefault();
                onOpen(selectedId);
              } else if (event.key === "Escape" && selectedId) {
                event.preventDefault();
                onSelect(null);
              } else if (event.key === "-") {
                event.preventDefault();
                zoomAt(0.8, element.clientWidth / 2, element.clientHeight / 2);
              }
            }}
          />
        </ContextMenuTrigger>
        {menuNode && (
          <ContextMenuContent>
            <ContextMenuItem onSelect={() => onTogglePin(menuNode)}>
              {pinned.has(menuNode) ? <PinOff /> : <Pin />}
              {pinned.has(menuNode) ? t("graphs.pins.unpin") : t("graphs.pins.pin")}
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => onOpen(menuNode)}>
              <ArrowUpRight />
              {t("graphs.pins.open")}
            </ContextMenuItem>
          </ContextMenuContent>
        )}
      </ContextMenu>
    </div>
  );
});
