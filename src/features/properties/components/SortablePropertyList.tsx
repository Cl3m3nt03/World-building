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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { type ReactNode, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Whether a key comes from a handle holding a property. A dialog around the
 * list checks it: Escape then cancels the move, it does not close the dialog.
 */
export function isMovingProperty(target: EventTarget | null) {
  return target instanceof Element && target.closest("[data-moving]") !== null;
}

type Props<T> = {
  items: T[];
  idOf: (item: T) => string;
  nameOf: (item: T) => string;
  /** Every id of the list, in the new order. */
  onReorder: (ids: string[]) => void;
  /** Names the list for screen readers. */
  label?: string;
  className?: string | undefined;
  rowClassName?: string | undefined;
  /** One row; `handle` is `null` while there is nothing to reorder. */
  children: (item: T, handle: ReactNode) => ReactNode;
};

/**
 * A list of properties reordered with a handle: dragged, or Space, arrows,
 * Space (Escape cancels), announced to screen readers. Each row places the
 * handle itself. Used by the types screen and by a card's own properties.
 */
export function SortablePropertyList<T>({
  items,
  idOf,
  nameOf,
  onReorder,
  label,
  className,
  rowClassName,
  children,
}: Props<T>) {
  const { t } = useTranslation();
  const ids = items.map(idOf);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
    }),
  );
  // A row over its own place right after being picked up is not announced.
  const lastOver = useRef<string | number | null>(null);

  const at = (id: string | number | undefined) => {
    const index = ids.indexOf(String(id));
    const item = items[index];
    return {
      name: item === undefined ? "" : nameOf(item),
      position: index + 1,
      count: items.length,
    };
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from >= 0 && to >= 0) onReorder(arrayMove(ids, from, to));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        screenReaderInstructions: { draggable: t("properties.dragInstructions") },
        announcements: {
          onDragStart: ({ active }: { active: Active }) => {
            lastOver.current = active.id;
            return t("properties.dragPicked", at(active.id));
          },
          onDragOver: ({ active, over }: { active: Active; over: Over | null }) => {
            if (!over || over.id === lastOver.current) return undefined;
            lastOver.current = over.id;
            return t("properties.dragOver", { ...at(over.id), name: at(active.id).name });
          },
          onDragMove: () => undefined,
          onDragEnd: ({ active, over }: { active: Active; over: Over | null }) =>
            t("properties.dragDropped", {
              ...at(over?.id ?? active.id),
              name: at(active.id).name,
            }),
          onDragCancel: ({ active }: { active: Active }) =>
            t("properties.dragCancelled", at(active.id)),
        },
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul aria-label={label} className={className}>
          {items.map((item) => (
            <SortableRow
              key={idOf(item)}
              id={idOf(item)}
              name={nameOf(item)}
              movable={items.length > 1}
              className={rowClassName}
            >
              {(handle) => children(item, handle)}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  id,
  name,
  movable,
  className,
  children,
}: {
  id: string;
  name: string;
  movable: boolean;
  className: string | undefined;
  children: (handle: ReactNode) => ReactNode;
}) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const handle = movable ? (
    <Button
      ref={setActivatorNodeRef}
      variant="ghost"
      size="icon-xs"
      aria-label={t("properties.drag", { name })}
      // Of dnd-kit's attributes, only the instructions: its role description is not translated.
      aria-describedby={attributes["aria-describedby"]}
      data-moving={isDragging || undefined}
      className="shrink-0 cursor-grab touch-none opacity-40 transition-opacity duration-(--bz-duration-fast) ease-atlas group-focus-within/property:opacity-100 group-hover/property:opacity-100"
      {...listeners}
    >
      <GripVertical />
    </Button>
  ) : null;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("group/property", isDragging && "relative z-10 opacity-70", className)}
    >
      {children(handle)}
    </li>
  );
}
