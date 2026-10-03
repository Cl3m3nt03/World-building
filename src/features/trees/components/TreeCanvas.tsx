import "@xyflow/react/dist/style.css";
import {
  applyNodeChanges,
  Background,
  type Connection,
  ConnectionLineType,
  ConnectionMode,
  type EdgeChange,
  type NodeChange,
  NodeToolbar,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useStore,
} from "@xyflow/react";
import { ExternalLink, GitBranchPlus, Replace, Trash2, UserRoundPlus } from "lucide-react";
import {
  type CSSProperties,
  forwardRef,
  type KeyboardEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { CardPicker } from "@/features/cards";
import type { Card, CardType, RelationType, VariantContent } from "@/lib/bindings";
import { cn } from "@/lib/utils";
import {
  addAnnotation,
  extendStroke,
  type FreeText,
  moveAnnotation,
  newDrawing,
  newText,
  removeAnnotation,
  updateDrawing,
  updateText,
} from "../annotations";
import {
  addJunctionRelative,
  addNode,
  addRelative,
  connect,
  connectFromEdge,
  fillNode,
  moveNodes,
  NODE_HEIGHT,
  NODE_WIDTH,
  newNode,
  reconnectEdge,
  removeEdge,
  removeNode,
  reverseEdge,
  updateEdge,
} from "../content";
import { JUNCTION_SIZE, linkGeometry, type Point } from "../geometry";
import { type Direction, naturalDirection, relationName } from "../relations";
import { AnnotationLayer, type Tool } from "./AnnotationLayer";
import { JunctionNode, type JunctionNodeType, junctionEdge, junctionId } from "./JunctionNode";
import { PersonNode, type PersonNodeType } from "./PersonNode";
import { RelationEdge, type RelationEdgeType } from "./RelationEdge";
import { RelationMenu } from "./RelationMenu";
import { type PenStyle, type TextStyle, TreeTools } from "./TreeTools";
import { type TreeActions, TreeActionsContext } from "./treeActions";

const NODE_TYPES = { person: PersonNode, junction: JunctionNode };
/** A junction point's attach points: one per side, each covering the point. */
const JUNCTION_HANDLES = (["top", "right", "bottom", "left"] as const).map((side) => ({
  id: side,
  type: "source" as const,
  position: side as Position,
  x: 0,
  y: 0,
  width: JUNCTION_SIZE,
  height: JUNCTION_SIZE,
}));
/** A node of the view: a person, or the middle of a link (where junctions start). */
type TreeNodeType = PersonNodeType | JunctionNodeType;
const EDGE_TYPES = { relation: RelationEdge };
/**
 * Framing of every node: a small tree is not blown up past its real size,
 * and nothing hides under the tools at the bottom or lacks room for its
 * « + » and bar above.
 */
const FIT_VIEW = {
  padding: { top: "110px", bottom: "120px", x: "60px" },
  maxZoom: 1,
} as const;
/** Space between a node and its bar: room for the « + » above it (as on the board). */
const TOOLBAR_OFFSET = 44;
/** Room kept around a node brought into view (px): its bar above, the tools below. */
const REVEAL_MARGIN = { top: 110, bottom: 90, side: 50 };
/** Arrows move the view this far, in px. */
const KEY_PAN = 60;
/** A new node is moved right by this much while it would cover another one. */
const NEW_NODE_STEP = NODE_WIDTH + 48;

export type TreeCanvasHandle = {
  /** Frames every node. */
  recenter: () => void;
  /** Adds an empty node in the middle of the view, selected, its picker open. */
  addNode: () => void;
};

type Props = {
  content: VariantContent;
  cardsById: ReadonlyMap<string, Card>;
  typesById: ReadonlyMap<string, CardType>;
  /** The world's relation types, provided ones first. */
  relationTypes: RelationType[];
  /** Accessible name of the view. */
  label: string;
  /**
   * Applies a change to the variant's content (it is then saved, and can be
   * undone; changes of the same `group` close together are one step).
   */
  onChange: (change: (previous: VariantContent) => VariantContent, group?: string) => void;
  onOpenCard: (cardId: string) => void;
  /** More tools for the bottom bar (the variants). */
  tools?: ReactNode;
  /** Shown above the bottom bar (the variants' tabs). */
  aboveTools?: ReactNode;
  /** Opens the window managing the world's relation types. */
  onManageRelations: () => void;
  /** The variant shown: another one clears the selections (the view stays, to compare). */
  variantId: string;
};

function toFlowNodes(
  content: VariantContent,
  cardsById: ReadonlyMap<string, Card>,
  typesById: ReadonlyMap<string, CardType>,
): PersonNodeType[] {
  return content.nodes.map((node) => {
    const card = node.cardId ? (cardsById.get(node.cardId) ?? null) : null;
    return {
      id: node.id,
      type: "person",
      position: { x: node.x ?? 0, y: node.y ?? 0 },
      data: {
        missing: node.cardId !== null && card === null,
        card,
        type: card?.typeId ? (typesById.get(card.typeId) ?? null) : null,
        label: node.label,
      },
    };
  });
}

/** A node standing for nothing yet (a lost card is not empty: it can be replaced). */
function isEmpty(node: PersonNodeType): boolean {
  return !node.data.card && !node.data.missing && node.data.label === "";
}

/** The name a node shows, for labels. */
function nodeName(node: PersonNodeType, empty: string): string {
  return node.data.card?.title ?? (node.data.label || empty);
}

/**
 * A variant of a relation tree drawn with React Flow (ADR 0001): nodes are
 * dragged to place them; the view zooms with the wheel, moves by dragging
 * the background, and with the keyboard (arrows, + and -) once focused.
 * The selected node has a bar: fill or replace it (a card or a plain
 * name), open its card, remove it. Clicking an empty node fills it,
 * double-clicking a card's node opens the card; on a focused node, Enter
 * opens its picker and Delete removes it.
 */
const TreeFlow = forwardRef<TreeCanvasHandle, Props>(function TreeFlow(
  {
    content,
    cardsById,
    typesById,
    relationTypes,
    label,
    onChange,
    onOpenCard,
    tools,
    aboveTools,
    variantId,
    onManageRelations,
  },
  ref,
) {
  const { t } = useTranslation();
  const flow = useReactFlow();
  const zoom = useStore((state) => state.transform[2]);
  const wrapper = useRef<HTMLDivElement>(null);
  const fromContent = useMemo(
    () => toFlowNodes(content, cardsById, typesById),
    [content, cardsById, typesById],
  );
  // Nodes as React Flow moves them; the content follows when a drag ends.
  const [nodes, setNodes] = useState<PersonNodeType[]>(fromContent);
  // A node just added: selected once it shows.
  const toSelect = useRef<string | null>(null);
  /**
   * Moves the view (same zoom) so that a node at `at` shows with room for
   * its bar above and the tools below, when it does not already.
   */
  const reveal = (at: { x: number; y: number }) => {
    const box = wrapper.current?.getBoundingClientRect();
    if (!box) return;
    const topLeft = flow.flowToScreenPosition(at);
    const bottomRight = flow.flowToScreenPosition({ x: at.x + NODE_WIDTH, y: at.y + NODE_HEIGHT });
    const shown =
      topLeft.x >= box.left + REVEAL_MARGIN.side &&
      bottomRight.x <= box.right - REVEAL_MARGIN.side &&
      topLeft.y >= box.top + REVEAL_MARGIN.top &&
      bottomRight.y <= box.bottom - REVEAL_MARGIN.bottom;
    if (shown) return;
    void flow.setCenter(at.x + NODE_WIDTH / 2, at.y + NODE_HEIGHT / 2, {
      zoom: flow.getZoom(),
      duration: 200,
    });
  };
  const revealRef = useRef(reveal);
  revealRef.current = reveal;
  useEffect(() => {
    // A node just added is brought into view (its bar above it, the tools below).
    const added = toSelect.current && fromContent.find((node) => node.id === toSelect.current);
    if (added) revealRef.current(added.position);
    setNodes((shown) => {
      const wanted = toSelect.current;
      toSelect.current = null;
      const selected = wanted
        ? new Set([wanted])
        : new Set(shown.filter((node) => node.selected).map((node) => node.id));
      return fromContent.map((node) =>
        selected.has(node.id) ? { ...node, selected: true } : node,
      );
    });
  }, [fromContent]);
  // The node whose picker is open.
  const [picking, setPicking] = useState<string | null>(null);

  const selected = nodes.filter((node) => node.selected);
  const current = selected.length === 1 ? selected[0] : undefined;
  const emptyName = t("trees.nodes.empty");

  // Links, drawn between the nodes as they are now (also while dragged).
  const [hovered, setHovered] = useState<string | null>(null);
  const [selectedEdges, setSelectedEdges] = useState<ReadonlySet<string>>(new Set());
  const relationsById = useMemo(
    () => new Map(relationTypes.map((type) => [type.id, type])),
    [relationTypes],
  );
  // How each link runs (its sides, its middle), from where the nodes are now.
  const geometry = useMemo(
    () => linkGeometry(content, new Map(nodes.map((node) => [node.id, node.position]))),
    [content, nodes],
  );
  const edges = useMemo<RelationEdgeType[]>(() => {
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const edgesById = new Map(content.edges.map((edge) => [edge.id, edge]));
    // What a link's start is called: a node's name, or « A and B » for a
    // junction (the ends of the link it hangs from).
    const startName = (source: (typeof content.edges)[number]["source"], depth = 0): string => {
      if (source.kind === "node") {
        const node = byId.get(source.id);
        return node ? nodeName(node, emptyName) : emptyName;
      }
      const parent = edgesById.get(source.id);
      if (!parent || depth > 20) return emptyName;
      const end = byId.get(parent.target);
      return t("trees.edges.pair", {
        a: startName(parent.source, depth + 1),
        b: end ? nodeName(end, emptyName) : emptyName,
      });
    };
    return content.edges.flatMap((edge) => {
      const place = geometry.get(edge.id);
      const to = byId.get(edge.target);
      if (!place || !to) return [];
      const junction = edge.source.kind === "edge";
      const relation = edge.relationTypeId ? relationsById.get(edge.relationTypeId) : undefined;
      const names = { source: startName(edge.source), target: nodeName(to, emptyName) };
      const tooltip = relation
        ? t("trees.edges.tooltip", {
            ...names,
            // Inside a sentence: a provided relation reads in lower case, a
            // world's own keeps the case it was named with.
            relation: relation.builtin
              ? relationName(relation, t).toLocaleLowerCase()
              : relationName(relation, t),
          })
        : t("trees.edges.untyped", names);
      return [
        {
          id: edge.id,
          type: "relation" as const,
          source: edge.source.kind === "node" ? edge.source.id : junctionId(edge.source.id),
          target: to.id,
          sourceHandle: place.sourceSide,
          targetHandle: place.targetSide,
          // A junction keeps its start: only its end moves to another node.
          reconnectable: junction ? ("target" as const) : true,
          ariaLabel: tooltip,
          selected: selectedEdges.has(edge.id),
          data: {
            lineStyle: edge.lineStyle,
            relationTypeId: edge.relationTypeId,
            junction,
            tooltip,
            hovered: hovered === edge.id,
          },
        },
      ];
    });
  }, [content.edges, nodes, geometry, relationsById, emptyName, t, hovered, selectedEdges]);

  // The middle of each link: where a junction is drawn from.
  const junctions = useMemo<JunctionNodeType[]>(() => {
    const hanging = new Set(
      content.edges.flatMap((edge) => (edge.source.kind === "edge" ? [edge.source.id] : [])),
    );
    return [...geometry].map(([edgeId, place]) => ({
      id: junctionId(edgeId),
      type: "junction" as const,
      position: { x: place.middle.x - JUNCTION_SIZE / 2, y: place.middle.y - JUNCTION_SIZE / 2 },
      width: JUNCTION_SIZE,
      height: JUNCTION_SIZE,
      // Its size and attach points are known: React Flow need not measure
      // them (it only keeps measured attach points of nodes it has sizes for).
      measured: { width: JUNCTION_SIZE, height: JUNCTION_SIZE },
      handles: JUNCTION_HANDLES,
      draggable: false,
      selectable: false,
      focusable: false,
      data: {
        edgeId,
        visible: hovered === edgeId || selectedEdges.has(edgeId) || hanging.has(edgeId),
      },
    }));
  }, [content.edges, geometry, hovered, selectedEdges]);
  const flowNodes = useMemo<TreeNodeType[]>(() => [...nodes, ...junctions], [nodes, junctions]);

  const addRelativeTo = useCallback(
    (nodeId: string, direction: Direction, type: RelationType | null) => {
      let created: string | null = null;
      // The change runs at once (useTreeEditor): the new node's id is known here.
      onChange((previous) => {
        const result = addRelative(previous, nodeId, direction, type?.id ?? null);
        created = result.nodeId;
        return result.content;
      });
      if (created) {
        toSelect.current = created;
        setPicking(created);
      }
    },
    [onChange],
  );
  // The link whose relation list is open: a link just drawn asks for its relation.
  const [relationMenuFor, setRelationMenuFor] = useState<string | null>(null);
  const actions = useMemo<TreeActions>(
    () => ({
      relationTypes,
      addRelative: addRelativeTo,
      editEdge: (id, patch) => onChange((previous) => updateEdge(previous, id, patch)),
      reverseEdge: (id) => onChange((previous) => reverseEdge(previous, id)),
      removeEdge: (id) => {
        onChange((previous) => removeEdge(previous, id));
        setSelectedEdges((previous) => {
          const next = new Set(previous);
          next.delete(id);
          return next;
        });
        wrapper.current?.focus();
      },
      addJunctionRelative: (edgeId, type) => {
        const middle: Point | undefined = geometry.get(edgeId)?.middle;
        if (!middle) return;
        let created: string | null = null;
        onChange((previous) => {
          const result = addJunctionRelative(previous, edgeId, middle, type?.id ?? null);
          created = result.nodeId;
          return result.content;
        });
        if (created) {
          setSelectedEdges(new Set());
          toSelect.current = created;
          setPicking(created);
        }
      },
      relationMenuFor,
      setRelationMenuFor,
      manageRelations: onManageRelations,
    }),
    [relationTypes, addRelativeTo, onChange, relationMenuFor, geometry, onManageRelations],
  );

  /** Selects only the link `id` (a link just drawn). */
  const selectEdge = (id: string) => {
    setNodes((shown) => shown.map((node) => (node.selected ? { ...node, selected: false } : node)));
    setSelectedEdges(new Set([id]));
  };

  const onConnect = (connection: Connection) => {
    let created: string | null = null;
    // From a link's middle (or onto it, drawn the other way): a junction.
    const fromLink = junctionEdge(connection.source);
    const toLink = junctionEdge(connection.target);
    onChange((previous) => {
      const result = fromLink
        ? connectFromEdge(previous, fromLink, connection.target)
        : toLink
          ? connectFromEdge(previous, toLink, connection.source)
          : connect(previous, connection.source, connection.target);
      created = result.edgeId;
      return result.content;
    });
    if (created) {
      selectEdge(created);
      setRelationMenuFor(created);
    }
  };

  // Which end of a link is being dragged to another node.
  const reconnecting = useRef<"source" | "target">("target");

  const remove = (id: string) => {
    onChange((previous) => removeNode(previous, id));
    setPicking(null);
    wrapper.current?.focus();
  };

  /** A closed picker leaves the focus on its node when it would be lost (keyboard). */
  // After Radix gave the focus back (its trigger may have been replaced since).
  const refocus = (id: string) =>
    setTimeout(() => {
      if (document.activeElement !== document.body) return;
      const node = wrapper.current?.querySelector<HTMLElement>(
        `.react-flow__node[data-id="${CSS.escape(id)}"]`,
      );
      (node ?? wrapper.current)?.focus();
    }, 50);

  /** Adds an empty node in the middle of the view, selected, its picker open. */
  function addNodeInView() {
    const box = wrapper.current?.getBoundingClientRect();
    const middle = box
      ? flow.screenToFlowPosition({ x: box.left + box.width / 2, y: box.top + box.height / 2 })
      : { x: 0, y: 0 };
    let x = middle.x - NODE_WIDTH / 2;
    const y = middle.y - NODE_HEIGHT / 2;
    const covers = () =>
      content.nodes.some(
        (node) =>
          Math.abs((node.x ?? 0) - x) < NODE_WIDTH + 16 &&
          Math.abs((node.y ?? 0) - y) < NODE_HEIGHT + 16,
      );
    for (let tries = 0; tries < 200 && covers(); tries++) x += NEW_NODE_STEP;
    const node = newNode(Math.round(x), Math.round(y));
    toSelect.current = node.id;
    onChange((previous) => addNode(previous, node));
    setPicking(node.id);
  }

  useImperativeHandle(ref, () => ({
    recenter: () => void flow.fitView({ ...FIT_VIEW, duration: 200 }),
    addNode: () => addNodeInView(),
  }));

  const onKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    // A focused node: Enter opens its picker, Delete removes it.
    const nodeId = target.classList.contains("react-flow__node")
      ? target.getAttribute("data-id")
      : null;
    // A focused link: Delete removes it (Enter selects it: React Flow).
    const edgeId = target.classList.contains("react-flow__edge")
      ? target.getAttribute("data-id")
      : null;
    if (edgeId && (event.key === "Delete" || event.key === "Backspace")) {
      event.preventDefault();
      actions.removeEdge(edgeId);
      return;
    }
    if (nodeId) {
      if (event.key === "Enter") {
        event.preventDefault();
        setNodes((shown) => shown.map((node) => ({ ...node, selected: node.id === nodeId })));
        setPicking(nodeId);
      } else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        remove(nodeId);
      }
      return;
    }
    if (event.key === "Escape" && tool !== "select") {
      changeTool("select");
      return;
    }
    // Only on the view itself, not while a field or a button has the focus.
    if (event.target !== event.currentTarget) return;
    const steps: Record<string, [number, number]> = {
      ArrowLeft: [KEY_PAN, 0],
      ArrowRight: [-KEY_PAN, 0],
      ArrowUp: [0, KEY_PAN],
      ArrowDown: [0, -KEY_PAN],
    };
    const step = steps[event.key];
    if (step) {
      event.preventDefault();
      const { x, y, zoom } = flow.getViewport();
      void flow.setViewport({ x: x + step[0], y: y + step[1], zoom });
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      void flow.zoomIn({ duration: 150 });
    } else if (event.key === "-") {
      event.preventDefault();
      void flow.zoomOut({ duration: 150 });
    }
  };

  const empty = current ? isEmpty(current) : false;

  // Tools (as on the board): select, pan, draw (or erase), write.
  const [tool, setTool] = useState<Tool>("select");
  const [pen, setPen] = useState<PenStyle>({ color: "ink", width: 4 });
  const [textStyle, setTextStyle] = useState<TextStyle>({ color: "ink", size: 20 });
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);
  const [editingAnnotation, setEditingAnnotation] = useState<string | null>(null);
  const [draft, setDraft] = useState<[number, number][] | null>(null);
  const [draftText, setDraftText] = useState<FreeText | null>(null);
  const annotation = content.annotations.find((a) => a.id === selectedAnnotation);

  // Another variant: nothing of the previous one stays selected or open.
  const shownVariant = useRef(variantId);
  useEffect(() => {
    if (shownVariant.current === variantId) return;
    shownVariant.current = variantId;
    setPicking(null);
    setSelectedEdges(new Set());
    setRelationMenuFor(null);
    setHovered(null);
    toSelect.current = null;
    setSelectedAnnotation(null);
    setEditingAnnotation(null);
    setDraftText(null);
  }, [variantId]);
  const changeTool = (next: Tool) => {
    setTool(next);
    setSelectedAnnotation(null);
    setPicking(null);
    if (next !== "select") {
      setNodes((shown) =>
        shown.map((node) => (node.selected ? { ...node, selected: false } : node)),
      );
      setSelectedEdges(new Set());
    }
  };

  /**
   * Drawing and writing take the pointer before React Flow: a stroke starts
   * (or a text is placed) anywhere on the tree, nodes included, but not on
   * the tools, an open field or a menu.
   */
  const onPointerDownCapture = (event: ReactPointerEvent) => {
    if (event.button !== 0 || (tool !== "draw" && tool !== "text")) return;
    const target = event.target as HTMLElement;
    if (target.closest("[role=toolbar], input, [role=menu], [role=dialog]")) return;
    event.preventDefault();
    event.stopPropagation();
    const at = flow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
    if (tool === "text") {
      // Written first, added once written: one step to undo, nothing empty saved.
      const text = newText(Math.round(at.x), Math.round(at.y), textStyle.color, textStyle.size);
      setDraftText(text);
      setEditingAnnotation(text.id);
      return;
    }
    let points: [number, number][] = [[at.x, at.y]];
    setDraft(points);
    const move = (moved: PointerEvent) => {
      const p = flow.screenToFlowPosition({ x: moved.clientX, y: moved.clientY });
      const next = extendStroke(points, p.x, p.y);
      if (next !== points) {
        points = next;
        setDraft(points);
      }
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDraft(null);
      const rounded = points.map(
        ([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10] as [number, number],
      );
      onChange((previous) => addAnnotation(previous, newDrawing(rounded, pen.color, pen.width)));
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      ref={wrapper}
      role="application"
      aria-label={label}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: the view takes the keyboard to move
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDownCapture={onPointerDownCapture}
      // Attach points keep a grab area of the same size on screen (globals.css).
      style={{ "--bz-zoom": zoom } as CSSProperties}
      className={cn(
        "bz-tree relative size-full rounded-lg bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        tool === "draw" && "cursor-crosshair",
        tool === "text" && "cursor-text",
        tool === "erase" && "bz-tree-erasing",
        // A selected link's ends are dragged: the attach points let them through.
        edges.some((edge) => edge.selected) && "bz-tree-edge-selected",
      )}
    >
      <TreeActionsContext.Provider value={actions}>
        <ReactFlow<TreeNodeType, RelationEdgeType>
          nodes={flowNodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          connectionMode={ConnectionMode.Loose}
          connectionLineType={ConnectionLineType.SmoothStep}
          connectionRadius={32}
          onConnect={onConnect}
          nodesDraggable={tool === "select"}
          nodesConnectable={tool === "select"}
          elementsSelectable={tool === "select"}
          panOnDrag={tool === "select" || tool === "pan"}
          edgesReconnectable={tool === "select"}
          reconnectRadius={14}
          onReconnectStart={(_, __, fixedEnd) => {
            // React Flow gives the end that stays: the dragged one is the other.
            reconnecting.current = fixedEnd === "target" ? "source" : "target";
          }}
          onReconnect={(old, connection) => {
            const end = reconnecting.current;
            // The end that did not move stays; the other goes to the new node.
            const fixed = end === "target" ? old.source : old.target;
            const nodeId = connection.source === fixed ? connection.target : connection.source;
            onChange((previous) => reconnectEdge(previous, old.id, end, nodeId));
          }}
          onEdgesChange={(changes: EdgeChange<RelationEdgeType>[]) => {
            const selects = changes.filter((change) => change.type === "select");
            if (selects.length === 0) return;
            setSelectedEdges((previous) => {
              const next = new Set(previous);
              for (const change of selects) {
                if (change.selected) next.add(change.id);
                else next.delete(change.id);
              }
              return next;
            });
            // A link left: its relation list must not come back with it.
            const left = new Set(selects.filter((c) => !c.selected).map((c) => c.id));
            setRelationMenuFor((open) => (open && left.has(open) ? null : open));
          }}
          onEdgeMouseEnter={(_, edge) => setHovered(edge.id)}
          onEdgeMouseLeave={() => setHovered(null)}
          // The middle of a link is part of it: hovering it is hovering the link.

          onNodeMouseEnter={(_, node) => {
            if (node.type === "junction") setHovered(node.data.edgeId);
          }}
          onNodeMouseLeave={(_, node) => {
            if (node.type === "junction") setHovered(null);
          }}
          onNodesChange={(changes: NodeChange<TreeNodeType>[]) => {
            // The junction points follow their links: only the people change.
            const people = changes.filter(
              (change) => !("id" in change) || !junctionEdge(change.id),
            ) as NodeChange<PersonNodeType>[];
            setNodes((shown) => applyNodeChanges(people, shown));
          }}
          onNodeDragStop={(_, __, dragged) =>
            onChange((previous) =>
              moveNodes(previous, new Map(dragged.map((node) => [node.id, node.position]))),
            )
          }
          onNodeClick={(_, node) => {
            if (node.type === "person" && isEmpty(node)) setPicking(node.id);
          }}
          onNodeDoubleClick={(_, node) => {
            if (node.type === "person" && node.data.card) onOpenCard(node.data.card.id);
          }}
          onPaneClick={() => {
            setPicking(null);
            setSelectedAnnotation(null);
          }}
          fitView
          fitViewOptions={FIT_VIEW}
          minZoom={0.1}
          maxZoom={3}
          proOptions={{ hideAttribution: true }}
          deleteKeyCode={null}
          zoomOnDoubleClick={false}
        >
          <Background gap={24} size={1} />
          <AnnotationLayer
            annotations={draftText ? [...content.annotations, draftText] : content.annotations}
            tool={tool}
            draft={draft ? { points: draft, color: pen.color, width: pen.width } : null}
            selectedId={selectedAnnotation}
            editingId={editingAnnotation}
            onSelect={setSelectedAnnotation}
            onEdit={setEditingAnnotation}
            onMove={(id, dx, dy) =>
              onChange((previous) => moveAnnotation(previous, id, dx, dy), `move:${id}`)
            }
            onRemove={(id) => {
              onChange((previous) => removeAnnotation(previous, id));
              setSelectedAnnotation((selected) => (selected === id ? null : selected));
            }}
            onText={(id, text) => {
              if (draftText?.id === id) {
                if (text.trim() !== "") {
                  onChange((previous) =>
                    addAnnotation(previous, { ...draftText, text: text.trim() }),
                  );
                }
                setDraftText(null);
              } else {
                onChange((previous) => updateText(previous, id, { text }));
              }
              setEditingAnnotation(null);
            }}
          />
          {current && (
            <NodeToolbar
              nodeId={current.id}
              position={Position.Top}
              offset={TOOLBAR_OFFSET}
              isVisible
            >
              <div
                role="toolbar"
                aria-label={t("trees.nodes.toolbar", { name: nodeName(current, emptyName) })}
                className="glass flex items-center gap-1 rounded-lg p-1"
              >
                <CardPicker
                  label={t("trees.nodes.searchOrName")}
                  placeholder={t("trees.nodes.pickerPlaceholder")}
                  // Above the bar: the node itself stays visible.
                  side="top"
                  allowedTypeIds={[]}
                  open={picking === current.id}
                  onOpenChange={(open) => {
                    setPicking(open ? current.id : null);
                    if (!open) refocus(current.id);
                  }}
                  onPick={(cardId) =>
                    onChange((previous) => fillNode(previous, current.id, { cardId }))
                  }
                  onPickName={(name) =>
                    onChange((previous) => fillNode(previous, current.id, { label: name }))
                  }
                >
                  <Button variant="ghost" size="sm">
                    {empty ? <UserRoundPlus /> : <Replace />}
                    {empty ? t("trees.nodes.fill") : t("trees.nodes.replace")}
                  </Button>
                </CardPicker>
                <RelationMenu
                  relationTypes={relationTypes}
                  onManage={onManageRelations}
                  onPick={(type) => addRelativeTo(current.id, naturalDirection(type), type)}
                >
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("trees.relations.add")}
                    title={t("trees.relations.add")}
                  >
                    <GitBranchPlus />
                  </Button>
                </RelationMenu>
                {current.data.card && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => current.data.card && onOpenCard(current.data.card.id)}
                  >
                    <ExternalLink />
                    {t("trees.nodes.openCard")}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("trees.nodes.delete")}
                  title={t("trees.nodes.delete")}
                  className="text-destructive"
                  onClick={() => remove(current.id)}
                >
                  <Trash2 />
                </Button>
              </div>
            </NodeToolbar>
          )}
        </ReactFlow>
      </TreeActionsContext.Provider>
      <TreeTools
        tool={tool}
        onTool={changeTool}
        pen={pen}
        onPen={setPen}
        text={textStyle}
        onText={setTextStyle}
        selected={annotation}
        onSelectedStyle={({ color, size, width }) => {
          if (!annotation) return;
          onChange((previous) =>
            annotation.kind === "text"
              ? updateText(previous, annotation.id, {
                  ...(color ? { color } : {}),
                  ...(size ? { size } : {}),
                })
              : updateDrawing(previous, annotation.id, {
                  ...(color ? { color } : {}),
                  ...(width ? { width } : {}),
                }),
          );
        }}
        onSelectedRemove={() => {
          if (!annotation) return;
          onChange((previous) => removeAnnotation(previous, annotation.id));
          setSelectedAnnotation(null);
        }}
        onAddNode={() => {
          changeTool("select");
          addNodeInView();
        }}
        onRecenter={() => void flow.fitView({ ...FIT_VIEW, duration: 200 })}
        above={aboveTools}
      >
        {tools}
      </TreeTools>
    </div>
  );
});

export const TreeCanvas = forwardRef<TreeCanvasHandle, Props>(function TreeCanvas(props, ref) {
  return (
    <ReactFlowProvider>
      <TreeFlow ref={ref} {...props} />
    </ReactFlowProvider>
  );
});
