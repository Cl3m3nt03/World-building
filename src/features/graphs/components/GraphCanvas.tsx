import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { assetUrl } from "@/lib/assets";
import type { CardType, GraphEdge, GraphNode } from "@/lib/bindings";
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

/** View: a point of the graph (x, y) is drawn at (x * k + tx, y * k + ty). */
type Transform = { tx: number; ty: number; k: number };

export type GraphCanvasHandle = {
  /** Frames every node. */
  recenter: () => void;
  /** Moves the view so that the node `id` is at the centre. */
  centerOn: (id: string) => void;
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
  { nodes, edges, typesById, settings, label, selectedId, highlighted = null, onSelect, onOpen },
  ref,
) {
  const container = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const transform = useRef<Transform>({ tx: 0, ty: 0, k: 1 });
  // Until the view is moved by hand, it keeps framing the whole graph.
  const autoFit = useRef(true);
  const frame = useRef<number | null>(null);
  const images = useRef(new Map<string, HTMLImageElement | "loading" | "failed">());
  // Where each node was last drawn: a filter that changes the nodes keeps
  // the others in place instead of laying everything out again.
  const lastPositions = useRef(new Map<string, [number, number]>());

  // The collision radius follows the size setting when the layout starts
  // again; a size change alone does not restart it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above
  const simNodes = useMemo<SimNodeInput[]>(
    () =>
      nodes.map((node) => {
        const last = lastPositions.current.get(node.id);
        return {
          id: node.id,
          radius: NODE_RADIUS * settings.nodeSize,
          ...(last ? { x: last[0], y: last[1] } : {}),
        };
      }),
    [nodes],
  );
  const simLinks = useMemo<SimLinkInput[]>(
    () => edges.map((edge) => ({ source: edge.source, target: edge.target, weight: edge.weight })),
    [edges],
  );
  const indexOf = useMemo(() => new Map(nodes.map((node, index) => [node.id, index])), [nodes]);
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
    if (autoFit.current) frameAll(width, height);
    const { tx, ty, k } = transform.current;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.setTransform(ratio * k, 0, 0, ratio * k, ratio * tx, ratio * ty);

    const at = (id: string): [number, number] | null => {
      const index = indexOf.get(id);
      if (index === undefined || index * 2 + 1 >= positions.length) return null;
      return [positions[index * 2] as number, positions[index * 2 + 1] as number];
    };

    // Edges, thicker with the number of links.
    context.strokeStyle = cssVar("--muted-foreground", "#888");
    for (const edge of edges) {
      const a = at(edge.source);
      const b = at(edge.target);
      if (!a || !b) continue;
      const lit = !focus || (focus.has(edge.source) && focus.has(edge.target));
      context.globalAlpha = lit ? 0.45 : 0.06;
      context.lineWidth = (1 + Math.log2(edge.weight)) / k ** 0.5;
      context.beginPath();
      context.moveTo(a[0], a[1]);
      context.lineTo(b[0], b[1]);
      context.stroke();
    }
    context.globalAlpha = 1;

    // Nodes: the card's image, or its type's colour and initial.
    const radius = NODE_RADIUS * settings.nodeSize;
    const background = cssVar("--background", "#fff");
    const foreground = cssVar("--foreground", "#000");
    const primary = cssVar("--primary", "#b07a2a");
    for (const node of nodes) {
      const p = at(node.id);
      if (!p) continue;
      const [x, y] = p;
      context.globalAlpha = !focus || focus.has(node.id) ? 1 : 0.18;
      const image = node.imageAssetId ? loadImage(node.imageAssetId) : null;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      if (image) {
        context.save();
        context.clip();
        const side = Math.min(image.naturalWidth, image.naturalHeight);
        context.drawImage(
          image,
          (image.naturalWidth - side) / 2,
          (image.naturalHeight - side) / 2,
          side,
          side,
          x - radius,
          y - radius,
          radius * 2,
          radius * 2,
        );
        context.restore();
      } else {
        const type = node.typeId ? typesById.get(node.typeId) : undefined;
        context.fillStyle = typeFill(type);
        context.fill();
        context.fillStyle = background;
        context.font = `600 ${radius}px sans-serif`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(node.title.slice(0, 1).toUpperCase(), x, y + radius * 0.05);
      }
      const selected = node.id === selectedId;
      context.lineWidth = (selected ? 3 : 1.5) / k;
      context.strokeStyle = selected ? primary : background;
      context.beginPath();
      context.arc(x, y, radius + (selected ? 1.5 / k : 0), 0, Math.PI * 2);
      context.stroke();
    }
    context.globalAlpha = 1;

    // Names under the nodes, readable at any zoom.
    if (settings.showLabels && k * radius > 6) {
      context.fillStyle = foreground;
      context.font = `${12 / k}px sans-serif`;
      context.textAlign = "center";
      context.textBaseline = "top";
      context.lineWidth = 3 / k;
      context.strokeStyle = background;
      for (const node of nodes) {
        const p = at(node.id);
        if (!p) continue;
        context.globalAlpha = !focus || focus.has(node.id) ? 1 : 0.18;
        context.strokeText(node.title, p[0], p[1] + radius + 3 / k);
        context.fillText(node.title, p[0], p[1] + radius + 3 / k);
      }
      context.globalAlpha = 1;
    }
  };

  const redraw = () => {
    if (frame.current === null) frame.current = requestAnimationFrame(draw);
  };

  const simulation = useSimulation({ nodes: simNodes, links: simLinks, settings, onTick: redraw });

  function loadImage(assetId: string): HTMLImageElement | null {
    const cached = images.current.get(assetId);
    if (cached instanceof HTMLImageElement) return cached;
    if (cached) return null;
    images.current.set(assetId, "loading");
    const image = new Image();
    image.onload = () => {
      images.current.set(assetId, image);
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
  }

  function panBy(dx: number, dy: number) {
    autoFit.current = false;
    const { tx, ty, k } = transform.current;
    transform.current = { k, tx: tx + dx, ty: ty + dy };
    redraw();
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
      redraw();
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
    },
  }));

  // The theme, the settings or the data changed: draw again.
  // biome-ignore lint/correctness/useExhaustiveDependencies: redraw reads the latest values
  useEffect(() => {
    redraw();
  }, [nodes, edges, settings, typesById, focus, selectedId]);

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
    | { kind: "node"; id: string; x: number; y: number; moved: boolean }
    | null
  >(null);
  const local = (event: { clientX: number; clientY: number }): [number, number] => {
    const box = canvas.current?.getBoundingClientRect();
    return [event.clientX - (box?.left ?? 0), event.clientY - (box?.top ?? 0)];
  };

  return (
    <div ref={container} className="relative size-full overflow-hidden rounded-lg bg-muted">
      <canvas
        ref={canvas}
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
            dragging.current = { ...held, moved };
          }
        }}
        onPointerUp={() => {
          const held = dragging.current;
          dragging.current = null;
          if (!held) return;
          if (held.kind === "node") {
            if (held.moved) simulation.send({ type: "drag", id: held.id, x: null, y: null });
            else onSelect(held.id);
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
    </div>
  );
});
