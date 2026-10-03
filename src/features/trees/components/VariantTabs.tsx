import {
  type Active,
  closestCenter,
  DndContext,
  type DragEndEvent,
  type Over,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { horizontalListSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeft, ArrowRight, Copy, EllipsisVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Variant = { id: string; name: string };

type Props = {
  variants: Variant[];
  current: string;
  onSelect: (id: string) => void;
  /** Adding a variant: the name field shows at the end of the tabs. */
  adding: boolean;
  onAddingChange: (adding: boolean) => void;
  onAdd: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onMove: (id: string, index: number) => void;
  onDelete: (id: string) => void;
};

/** A name being typed in place: Enter keeps it, Escape or an empty name gives up. */
function NameField({
  initial,
  label,
  onDone,
}: {
  initial: string;
  label: string;
  onDone: (name: string | null) => void;
}) {
  const [value, setValue] = useState(initial);
  const input = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  const finish = (name: string | null) => {
    if (done.current) return;
    done.current = true;
    onDone(name && name.trim() !== "" ? name.trim() : null);
  };
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);
  return (
    <input
      ref={input}
      aria-label={label}
      value={value}
      maxLength={100}
      className="h-7 w-32 rounded-md border border-primary bg-background px-2 text-sm outline-none"
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => finish(value)}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") {
          event.preventDefault();
          finish(value);
        } else if (event.key === "Escape") {
          event.preventDefault();
          finish(null);
        }
      }}
    />
  );
}

function Tab({
  variant,
  index,
  count,
  selected,
  props,
  onAskDelete,
}: {
  variant: Variant;
  index: number;
  count: number;
  selected: boolean;
  props: Props;
  /** Asks before deleting (it cannot be undone). */
  onAskDelete: (variant: Variant) => void;
}) {
  const { t } = useTranslation();
  const [renaming, setRenaming] = useState(false);
  const sortable = useSortable({ id: variant.id, disabled: renaming });
  const style = {
    transform: CSS.Translate.toString(sortable.transform),
    transition: sortable.transition,
  };
  return (
    <div
      ref={sortable.setNodeRef}
      style={style}
      className={cn(
        "flex items-center rounded-md",
        selected && "bg-secondary text-foreground",
        sortable.isDragging && "opacity-60",
      )}
    >
      {renaming ? (
        <NameField
          initial={variant.name}
          label={t("trees.variants.name")}
          onDone={(name) => {
            setRenaming(false);
            if (name && name !== variant.name) props.onRename(variant.id, name);
          }}
        />
      ) : (
        <button
          type="button"
          {...sortable.attributes}
          {...sortable.listeners}
          // A tab of the list (the arrows move between tabs), not dnd-kit's button.
          role="tab"
          aria-roledescription={undefined}
          id={`variant-tab-${variant.id}`}
          aria-selected={selected}
          tabIndex={selected ? 0 : -1}
          className="h-7 max-w-40 truncate px-2 text-sm text-muted-foreground outline-none aria-selected:font-medium aria-selected:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 rounded-md"
          onClick={() => props.onSelect(variant.id)}
          onDoubleClick={() => setRenaming(true)}
        >
          {variant.name}
        </button>
      )}
      {selected && !renaming && (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={t("trees.variants.menu", { name: variant.name })}
              title={t("trees.variants.menu", { name: variant.name })}
            >
              <EllipsisVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top">
            <DropdownMenuItem onSelect={() => setRenaming(true)}>
              <Pencil />
              {t("trees.variants.rename")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => props.onDuplicate(variant.id)}>
              <Copy />
              {t("trees.variants.duplicate")}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={index === 0}
              onSelect={() => props.onMove(variant.id, index - 1)}
            >
              <ArrowLeft />
              {t("trees.variants.moveLeft")}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={index === count - 1}
              onSelect={() => props.onMove(variant.id, index + 1)}
            >
              <ArrowRight />
              {t("trees.variants.moveRight")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={count === 1}
              onSelect={() => onAskDelete(variant)}
            >
              <Trash2 />
              {t("trees.variants.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

/**
 * The variants of a tree as tabs (docs/features/05-relation-tree.md): a
 * click shows one, the arrows move between them, a double click renames
 * one; the current one has a menu (rename, duplicate, move, delete — not
 * the last). Tabs are reordered by dragging. « + » names a new variant, a
 * copy of the current one.
 */
export function VariantTabs(props: Props) {
  const { t } = useTranslation();
  const { variants, current, onSelect, adding, onAddingChange, onAdd } = props;
  const [deleting, setDeleting] = useState<Variant | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const nameOf = (id: unknown) => variants.find((v) => v.id === id)?.name ?? "";
  const indexOf = (id: unknown) => variants.findIndex((v) => v.id === id);

  const onKeyDown = (event: KeyboardEvent) => {
    const index = variants.findIndex((v) => v.id === current);
    const next =
      event.key === "ArrowRight"
        ? index + 1
        : event.key === "ArrowLeft"
          ? index - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? variants.length - 1
              : null;
    if (next === null || (event.target as HTMLElement).tagName === "INPUT") return;
    event.preventDefault();
    const target = variants[Math.max(0, Math.min(variants.length - 1, next))];
    if (target) {
      onSelect(target.id);
      requestAnimationFrame(() => document.getElementById(`variant-tab-${target.id}`)?.focus());
    }
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    props.onMove(String(active.id), indexOf(over.id));
  };

  return (
    <div className="glass flex items-center gap-1 rounded-lg border border-border p-1 shadow-sm">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        accessibility={{
          announcements: {
            onDragStart: ({ active }: { active: Active }) =>
              t("trees.variants.dragPicked", { name: nameOf(active.id) }),
            onDragOver: ({ active, over }: { active: Active; over: Over | null }) =>
              over
                ? t("trees.variants.dragOver", {
                    name: nameOf(active.id),
                    position: indexOf(over.id) + 1,
                  })
                : undefined,
            onDragEnd: ({ active, over }: { active: Active; over: Over | null }) =>
              t("trees.variants.dragDropped", {
                name: nameOf(active.id),
                position: indexOf(over?.id ?? active.id) + 1,
              }),
            onDragCancel: ({ active }: { active: Active }) =>
              t("trees.variants.dragCancelled", { name: nameOf(active.id) }),
          },
        }}
      >
        <SortableContext items={variants.map((v) => v.id)} strategy={horizontalListSortingStrategy}>
          <div
            role="tablist"
            aria-label={t("trees.variants.label")}
            className="flex items-center gap-1"
            onKeyDown={onKeyDown}
          >
            {variants.map((variant, index) => (
              <Tab
                key={variant.id}
                variant={variant}
                index={index}
                count={variants.length}
                selected={variant.id === current}
                props={props}
                onAskDelete={setDeleting}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {adding ? (
        <NameField
          initial={t("trees.variants.numbered", { n: variants.length + 1 })}
          label={t("trees.variants.newName")}
          onDone={(name) => {
            onAddingChange(false);
            if (name) onAdd(name);
          }}
        />
      ) : (
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={t("trees.variants.add")}
          title={t("trees.variants.add")}
          onClick={() => onAddingChange(true)}
        >
          <Plus />
        </Button>
      )}
      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("trees.variants.deleteTitle", { name: deleting?.name ?? "" })}
            </DialogTitle>
            <DialogDescription>{t("trees.variants.deleteDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              {t("trees.variants.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleting) props.onDelete(deleting.id);
                setDeleting(null);
              }}
            >
              {t("trees.variants.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
