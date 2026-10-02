import {
  type Active,
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  type Over,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Link, useParams } from "@tanstack/react-router";
import { PinOff } from "lucide-react";
import { useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { typeColor, typeIcon, useCardTypes } from "@/features/card-types";
import { AssetImage } from "@/features/media";
import type { DocumentTree, TreeDocument } from "@/lib/bindings";
import { documentRoute } from "@/lib/documentRoute";
import { useMovePin, useSetPinned } from "../hooks/useDocumentTree";
import { pinnedDocuments } from "../tree";

type Props = {
  tree: DocumentTree;
  /** The document open in the workspace, if any. */
  currentId: string | null;
};

/**
 * "Pinned" at the top of the sidebar (docs/features/02-organisation.md): the
 * pinned documents as tiles with their image enlarged, in an order set by
 * dragging (pointer, or Space then arrows). Enter opens a document; its right
 * click unpins it. Nothing shows while nothing is pinned.
 */
export function PinnedSection({ tree, currentId }: Props) {
  const { t } = useTranslation();
  const pins = useMemo(() => pinnedDocuments(tree), [tree]);
  const move = useMovePin();
  const unpin = useSetPinned();
  // Space picks a tile up: Enter stays "open the document".
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
    }),
  );
  // A tile over its own place right after being picked up is not announced.
  const lastOver = useRef<string | number | null>(null);

  if (pins.length === 0) return null;

  const at = (id: string | number | undefined) => {
    const index = pins.findIndex((pin) => pin.id === id);
    return { name: pins[index]?.title ?? "", position: index + 1, count: pins.length };
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const index = pins.findIndex((pin) => pin.id === over.id);
    if (index >= 0) move.mutate({ id: String(active.id), index });
  };
  const error = move.error ?? unpin.error;

  return (
    <section
      aria-labelledby="pinned-title"
      className="flex flex-col gap-1.5 border-b border-border p-2"
    >
      <h2 id="pinned-title" className="px-1 text-xs font-medium text-muted-foreground">
        {t("sidebar.pins.title")}
      </h2>
      {error && <AppErrorMessage error={error} />}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        accessibility={{
          screenReaderInstructions: { draggable: t("sidebar.pins.dragInstructions") },
          announcements: {
            onDragStart: ({ active }: { active: Active }) => {
              lastOver.current = active.id;
              return t("sidebar.pins.picked", at(active.id));
            },
            onDragOver: ({ active, over }: { active: Active; over: Over | null }) => {
              if (!over || over.id === lastOver.current) return undefined;
              lastOver.current = over.id;
              return t("sidebar.pins.over", { ...at(over.id), name: at(active.id).name });
            },
            onDragMove: () => undefined,
            onDragEnd: ({ active, over }: { active: Active; over: Over | null }) =>
              t("sidebar.pins.dropped", { ...at(over?.id ?? active.id), name: at(active.id).name }),
            onDragCancel: ({ active }: { active: Active }) =>
              t("sidebar.pins.cancelled", at(active.id)),
          },
        }}
      >
        <SortableContext items={pins.map((pin) => pin.id)} strategy={rectSortingStrategy}>
          <ul
            aria-labelledby="pinned-title"
            className="scrollbar-thin grid max-h-60 grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-1.5 overflow-y-auto"
          >
            {pins.map((pin) => (
              <PinTile
                key={pin.id}
                document={pin}
                isCurrent={pin.id === currentId}
                onUnpin={() => unpin.mutate({ id: pin.id, pinned: false })}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </section>
  );
}

function PinTile({
  document,
  isCurrent,
  onUnpin,
}: {
  document: TreeDocument;
  isCurrent: boolean;
  onUnpin: () => void;
}) {
  const { t } = useTranslation();
  const { worldId } = useParams({ from: "/world/$worldId" });
  const types = useCardTypes();
  const type = types.data?.find((candidate) => candidate.id === document.typeId);
  const Icon = typeIcon(type?.icon ?? "shapes");
  const color = typeColor(type?.color ?? "slate");
  const sortable = useSortable({ id: document.id });

  return (
    <li
      ref={sortable.setNodeRef}
      style={{
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
      }}
      className={sortable.isDragging ? "relative z-10 opacity-70" : undefined}
    >
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <Link
            {...documentRoute(worldId, document.kind, document.id)}
            {...sortable.listeners}
            // Of dnd-kit's attributes, only the instructions: the link keeps its role.
            aria-describedby={sortable.attributes["aria-describedby"]}
            aria-current={isCurrent ? "page" : undefined}
            className="group flex flex-col overflow-hidden rounded-md border border-border bg-background/40 text-xs text-muted-foreground outline-none select-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:border-primary aria-[current=page]:text-foreground"
          >
            <span className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-muted">
              {document.imageAssetId ? (
                <AssetImage
                  assetId={document.imageAssetId}
                  alt=""
                  draggable={false}
                  className="size-full object-cover"
                />
              ) : (
                <Icon aria-hidden className="size-6" style={{ color }} />
              )}
            </span>
            <span className="flex items-center gap-1 px-1.5 py-1">
              <Icon aria-hidden className="size-3 shrink-0" style={{ color }} />
              <span className="truncate">{document.title}</span>
            </span>
          </Link>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={onUnpin}>
            <PinOff />
            {t("sidebar.pins.unpin")}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </li>
  );
}
