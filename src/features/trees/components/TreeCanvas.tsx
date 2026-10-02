import "@xyflow/react/dist/style.css";
import {
  applyNodeChanges,
  Background,
  type NodeChange,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import {
  forwardRef,
  type KeyboardEvent,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import type { Card, CardType, VariantContent } from "@/lib/bindings";
import { PersonNode, type PersonNodeType } from "./PersonNode";

const NODE_TYPES = { person: PersonNode };
/** Framing of every node: a small tree is not blown up past its real size. */
const FIT_VIEW = { padding: 0.2, maxZoom: 1 };
/** Arrows move the view this far, in px. */
const KEY_PAN = 60;

export type TreeCanvasHandle = {
  /** Frames every node. */
  recenter: () => void;
};

type Props = {
  content: VariantContent;
  cardsById: ReadonlyMap<string, Card>;
  typesById: ReadonlyMap<string, CardType>;
  /** Accessible name of the view. */
  label: string;
  /** Nodes dropped at new places (tree coordinates). */
  onMoveNodes: (positions: ReadonlyMap<string, { x: number; y: number }>) => void;
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
        card,
        type: card?.typeId ? (typesById.get(card.typeId) ?? null) : null,
        label: node.label,
      },
    };
  });
}

/**
 * A variant of a relation tree drawn with React Flow (ADR 0001): nodes are
 * dragged to place them; the view zooms with the wheel, moves by dragging
 * the background, and with the keyboard (arrows, + and -) once focused.
 */
const TreeFlow = forwardRef<TreeCanvasHandle, Props>(function TreeFlow(
  { content, cardsById, typesById, label, onMoveNodes },
  ref,
) {
  const flow = useReactFlow();
  const fromContent = useMemo(
    () => toFlowNodes(content, cardsById, typesById),
    [content, cardsById, typesById],
  );
  // Nodes as React Flow moves them; the content follows when a drag ends.
  const [nodes, setNodes] = useState<PersonNodeType[]>(fromContent);
  useEffect(() => {
    setNodes((shown) => {
      const selected = new Set(shown.filter((node) => node.selected).map((node) => node.id));
      return fromContent.map((node) =>
        selected.has(node.id) ? { ...node, selected: true } : node,
      );
    });
  }, [fromContent]);

  useImperativeHandle(ref, () => ({
    recenter: () => void flow.fitView({ ...FIT_VIEW, duration: 200 }),
  }));

  const onKeyDown = (event: KeyboardEvent) => {
    // Only on the view itself, not while a node or a field has the focus.
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

  return (
    <div
      role="application"
      aria-label={label}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: the view takes the keyboard to move
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="bz-tree size-full rounded-lg bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <ReactFlow
        nodes={nodes}
        edges={[]}
        nodeTypes={NODE_TYPES}
        onNodesChange={(changes: NodeChange<PersonNodeType>[]) =>
          setNodes((shown) => applyNodeChanges(changes, shown))
        }
        onNodeDragStop={(_, __, dragged) =>
          onMoveNodes(new Map(dragged.map((node) => [node.id, node.position])))
        }
        fitView
        fitViewOptions={FIT_VIEW}
        minZoom={0.1}
        maxZoom={3}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={null}
      >
        <Background gap={24} size={1} />
      </ReactFlow>
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
