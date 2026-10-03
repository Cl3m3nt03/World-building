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
import { Check, LayoutGrid, Plus, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AssetImage } from "@/features/media";
import type { WikiPage } from "@/lib/bindings";
import { fold } from "@/lib/text";
import { cn } from "@/lib/utils";
import { pageRoute } from "../links";
import { featuredPages, moveFeatured } from "../pages";
import { PageIcon } from "./PageIcon";
import { WIKI_BUTTON, WIKI_FOCUS } from "./styles";

type Props = {
  /** The wiki's pages. */
  pages: WikiPage[];
  /** The featured ids, in order (some may no longer be pages). */
  featured: string[];
  onChange: (featured: string[]) => void;
};

/**
 * The grid of featured pages on the wiki's home page. « Modifier la grille »
 * adds pages, removes them, and orders them by dragging (pointer, or Space
 * then arrows).
 */
export function FeaturedGrid({ pages, featured, onChange }: Props) {
  const { t } = useTranslation();
  const headingId = useId();
  const [editing, setEditing] = useState(false);
  const shown = featuredPages(featured, pages);

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id={headingId} className="font-wiki-heading text-lg font-bold">
          {t("wiki.grid.title")}
        </h2>
        {editing ? (
          <div className="flex gap-2">
            <AddPage
              pages={pages.filter((page) => !featured.includes(page.id))}
              onAdd={(id) => onChange([...featured, id])}
            />
            <button type="button" className={WIKI_BUTTON} onClick={() => setEditing(false)}>
              <Check aria-hidden />
              {t("wiki.grid.done")}
            </button>
          </div>
        ) : (
          <button type="button" className={WIKI_BUTTON} onClick={() => setEditing(true)}>
            <LayoutGrid aria-hidden />
            {t("wiki.grid.edit")}
          </button>
        )}
      </div>
      {shown.length === 0 ? (
        <p className="rounded-lg border border-dashed border-wiki-text/20 p-6 text-center text-sm text-wiki-muted">
          {t(editing ? "wiki.grid.emptyEditing" : "wiki.grid.empty")}
        </p>
      ) : editing ? (
        <SortableGrid
          pages={shown}
          onMove={(id, overId) => onChange(moveFeatured(featured, id, overId))}
          onRemove={(id) => onChange(featured.filter((candidate) => candidate !== id))}
        />
      ) : (
        <ul aria-labelledby={headingId} className={GRID}>
          {shown.map((page) => (
            <li key={page.id}>
              <PageTile page={page} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const GRID = "grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3";

const TILE =
  "group relative flex aspect-[4/5] w-full flex-col justify-end overflow-hidden rounded-lg bg-wiki-surface text-left";

/** A page's image (or icon), and its name over it. */
function TileContent({ page }: { page: WikiPage }) {
  return (
    <>
      {page.imageAssetId ? (
        <AssetImage
          assetId={page.imageAssetId}
          alt=""
          draggable={false}
          className="absolute inset-0 size-full object-cover transition duration-300 group-hover:scale-105 motion-reduce:transition-none"
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center pb-8">
          <PageIcon page={page} className="size-10 opacity-60" />
        </span>
      )}
      <span
        className={cn(
          "relative flex items-center gap-1.5 px-2.5 pt-6 pb-2 text-sm font-medium",
          page.imageAssetId && "bg-gradient-to-t from-black/70 to-transparent text-white",
        )}
      >
        <span className="truncate">{page.title}</span>
      </span>
    </>
  );
}

function PageTile({ page }: { page: WikiPage }) {
  const { worldId } = useParams({ from: "/world/$worldId" });
  return (
    <Link {...pageRoute(worldId, page)} className={cn(TILE, WIKI_FOCUS)}>
      <TileContent page={page} />
    </Link>
  );
}

function SortableGrid({
  pages,
  onMove,
  onRemove,
}: {
  pages: WikiPage[];
  onMove: (id: string, overId: string) => void;
  onRemove: (id: string) => void;
}) {
  const { t } = useTranslation();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  // A tile over its own place right after being picked up is not announced.
  const lastOver = useRef<string | number | null>(null);
  const at = (id: string | number | undefined) => {
    const index = pages.findIndex((page) => page.id === id);
    return { name: pages[index]?.title ?? "", position: index + 1, count: pages.length };
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) onMove(String(active.id), String(over.id));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        screenReaderInstructions: { draggable: t("wiki.grid.dragInstructions") },
        announcements: {
          onDragStart: ({ active }: { active: Active }) => {
            lastOver.current = active.id;
            return t("wiki.grid.picked", at(active.id));
          },
          onDragOver: ({ active, over }: { active: Active; over: Over | null }) => {
            if (!over || over.id === lastOver.current) return undefined;
            lastOver.current = over.id;
            return t("wiki.grid.over", { ...at(over.id), name: at(active.id).name });
          },
          onDragMove: () => undefined,
          onDragEnd: ({ active, over }: { active: Active; over: Over | null }) =>
            t("wiki.grid.dropped", { ...at(over?.id ?? active.id), name: at(active.id).name }),
          onDragCancel: ({ active }: { active: Active }) => t("wiki.grid.cancelled", at(active.id)),
        },
      }}
    >
      <SortableContext items={pages.map((page) => page.id)} strategy={rectSortingStrategy}>
        <ul className={GRID}>
          {pages.map((page) => (
            <SortableTile key={page.id} page={page} onRemove={() => onRemove(page.id)} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableTile({ page, onRemove }: { page: WikiPage; onRemove: () => void }) {
  const { t } = useTranslation();
  const sortable = useSortable({ id: page.id });
  return (
    <li
      ref={sortable.setNodeRef}
      style={{
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
      }}
      className={cn("relative", sortable.isDragging && "z-10 opacity-70")}
    >
      <button
        type="button"
        {...sortable.attributes}
        {...sortable.listeners}
        aria-label={page.title}
        className={cn(TILE, WIKI_FOCUS, "cursor-grab ring-2 ring-wiki-accent/40 select-none")}
      >
        <TileContent page={page} />
      </button>
      <button
        type="button"
        aria-label={t("wiki.grid.remove", { name: page.title })}
        onClick={onRemove}
        className={cn(
          "absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-wiki-surface text-wiki-text shadow transition hover:bg-wiki-background [&_svg]:size-3.5",
          WIKI_FOCUS,
        )}
      >
        <X aria-hidden />
      </button>
    </li>
  );
}

/** « Ajouter une page »: the pages not yet featured, with a filter. */
function AddPage({ pages, onAdd }: { pages: WikiPage[]; onAdd: (id: string) => void }) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState("");
  const wanted = fold(filter.trim());
  const shown = pages
    .filter((page) => [page.title, ...page.aliases].some((name) => fold(name).includes(wanted)))
    .sort((a, b) => a.title.localeCompare(b.title));

  return (
    <Popover onOpenChange={(open) => open || setFilter("")}>
      <PopoverTrigger asChild>
        <button type="button" className={WIKI_BUTTON} disabled={pages.length === 0}>
          <Plus aria-hidden />
          {t("wiki.grid.add")}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-72 flex-col gap-2 p-2">
        <Input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder={t("wiki.grid.addFilter")}
          aria-label={t("wiki.grid.addFilter")}
        />
        {shown.length === 0 ? (
          <p className="px-2 py-3 text-center text-xs text-muted-foreground">
            {t("wiki.grid.addNone")}
          </p>
        ) : (
          <ul className="scrollbar-thin flex max-h-64 flex-col overflow-y-auto">
            {shown.map((page) => (
              <li key={page.id}>
                <button
                  type="button"
                  onClick={() => onAdd(page.id)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent"
                >
                  <PageIcon page={page} className="size-4" />
                  <span className="truncate">{page.title}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
