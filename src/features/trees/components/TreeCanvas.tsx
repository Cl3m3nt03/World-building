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
} from "@xyflow/react";
import { ExternalLink, GitBranchPlus, Replace, Trash2, UserRoundPlus } from "lucide-react";
import {
  forwardRef,
  type KeyboardEvent,
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
  addNode,
  addRelative,
  connect,
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
import { type Direction, naturalDirection, relationName } from "../relations";
import { PersonNode, type PersonNodeType } from "./PersonNode";
import { RelationEdge, type RelationEdgeType } from "./RelationEdge";
import { RelationMenu } from "./RelationMenu";
import { type TreeActions, TreeActionsContext } from "./treeActions";

const NODE_TYPES = { person: PersonNode };
const EDGE_TYPES = { relation: RelationEdge };
/** Framing of every node: a small tree is not blown up past its real size. */
const FIT_VIEW = { padding: 0.2, maxZoom: 1 };
/** Space between a node and its bar: room for the « + » above it (as on the board). */
const TOOLBAR_OFFSET = 44;
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
  /** Applies a change to the variant's content (it is then saved). */
  onChange: (change: (previous: VariantContent) => VariantContent) => void;
  onOpenCard: (cardId: string) => void;
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

/**
 * The sides of two nodes a link between them attaches to: the ones facing
 * each other (above / below, or side by side).
 */
function facingSides(
  from: { x: number; y: number },
  to: { x: number; y: number },
): [Direction, Direction] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dy) / NODE_HEIGHT >= Math.abs(dx) / NODE_WIDTH) {
    return dy >= 0 ? ["bottom", "top"] : ["top", "bottom"];
  }
  return dx >= 0 ? ["right", "left"] : ["left", "right"];
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
  { content, cardsById, typesById, relationTypes, label, onChange, onOpenCard },
  ref,
) {
  const { t } = useTranslation();
  const flow = useReactFlow();
  const wrapper = useRef<HTMLDivElement>(null);
  const fromContent = useMemo(
    () => toFlowNodes(content, cardsById, typesById),
    [content, cardsById, typesById],
  );
  // Nodes as React Flow moves them; the content follows when a drag ends.
  const [nodes, setNodes] = useState<PersonNodeType[]>(fromContent);
  // A node just added: selected once it shows.
  const toSelect = useRef<string | null>(null);
  useEffect(() => {
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
  const edges = useMemo<RelationEdgeType[]>(() => {
    const byId = new Map(nodes.map((node) => [node.id, node]));
    return content.edges.flatMap((edge) => {
      // Links from a link (junctions) are drawn from step 6.6.
      if (edge.source.kind !== "node") return [];
      const from = byId.get(edge.source.id);
      const to = byId.get(edge.target);
      if (!from || !to) return [];
      const [sourceHandle, targetHandle] = facingSides(from.position, to.position);
      const relation = edge.relationTypeId ? relationsById.get(edge.relationTypeId) : undefined;
      const names = { source: nodeName(from, emptyName), target: nodeName(to, emptyName) };
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
          source: from.id,
          target: to.id,
          sourceHandle,
          targetHandle,
          ariaLabel: tooltip,
          selected: selectedEdges.has(edge.id),
          data: {
            lineStyle: edge.lineStyle,
            relationTypeId: edge.relationTypeId,
            junction: false,
            tooltip,
            hovered: hovered === edge.id,
          },
        },
      ];
    });
  }, [content.edges, nodes, relationsById, emptyName, t, hovered, selectedEdges]);

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
      relationMenuFor,
      setRelationMenuFor,
    }),
    [relationTypes, addRelativeTo, onChange, relationMenuFor],
  );

  /** Selects only the link `id` (a link just drawn). */
  const selectEdge = (id: string) => {
    setNodes((shown) => shown.map((node) => (node.selected ? { ...node, selected: false } : node)));
    setSelectedEdges(new Set([id]));
  };

  const onConnect = (connection: Connection) => {
    let created: string | null = null;
    onChange((previous) => {
      const result = connect(previous, connection.source, connection.target);
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

  useImperativeHandle(ref, () => ({
    recenter: () => void flow.fitView({ ...FIT_VIEW, duration: 200 }),
    addNode: () => {
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
    },
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

  return (
    <div
      ref={wrapper}
      role="application"
      aria-label={label}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: the view takes the keyboard to move
      tabIndex={0}
      onKeyDown={onKeyDown}
      className={cn(
        "bz-tree size-full rounded-lg bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        // A selected link's ends are dragged: the attach points let them through.
        edges.some((edge) => edge.selected) && "bz-tree-edge-selected",
      )}
    >
      <TreeActionsContext.Provider value={actions}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          connectionMode={ConnectionMode.Loose}
          connectionLineType={ConnectionLineType.SmoothStep}
          connectionRadius={32}
          onConnect={onConnect}
          edgesReconnectable
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
          onNodesChange={(changes: NodeChange<PersonNodeType>[]) =>
            setNodes((shown) => applyNodeChanges(changes, shown))
          }
          onNodeDragStop={(_, __, dragged) =>
            onChange((previous) =>
              moveNodes(previous, new Map(dragged.map((node) => [node.id, node.position]))),
            )
          }
          onNodeClick={(_, node) => {
            if (isEmpty(node)) setPicking(node.id);
          }}
          onNodeDoubleClick={(_, node) => {
            if (node.data.card) onOpenCard(node.data.card.id);
          }}
          onPaneClick={() => setPicking(null)}
          fitView
          fitViewOptions={FIT_VIEW}
          minZoom={0.1}
          maxZoom={3}
          proOptions={{ hideAttribution: true }}
          deleteKeyCode={null}
          zoomOnDoubleClick={false}
        >
          <Background gap={24} size={1} />
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
