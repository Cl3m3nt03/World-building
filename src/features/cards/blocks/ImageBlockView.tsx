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
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronLeft, ChevronRight, ImageOff, ImagePlus, RefreshCw, X } from "lucide-react";
import { type KeyboardEvent, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AssetImage, ImagePickerDialog, useAssets } from "@/features/media";
import { cn } from "@/lib/utils";
import { type GalleryImage, type ImageBlock, MAX_GALLERY_IMAGES, move, newId } from "./model";

type ImageBlockViewProps = {
  block: ImageBlock;
  /** Accessible name of the block ("Image block 2"). */
  label: string;
  onChange: (block: ImageBlock) => void;
  /** The block was just inserted: the image picker opens right away. */
  pickOnMount: boolean;
};

/** What the image picker is open for: adding images, or replacing the shown one. */
type Picking = "add" | "replace" | null;

/**
 * A gallery of media library images (docs/features/01-cartes-et-types.md, M3 step
 * 3.10): one image at a time with its own caption, arrows and thumbnails to
 * go through them (← → Home End on the thumbnails, one stop of Tab),
 * thumbnails reordered by dragging (pointer, or Space then arrows) and
 * removed with Delete. With a
 * single image it looks like a plain image. An image deleted from the media
 * library says so and can be replaced or removed.
 */
export function ImageBlockView({ block, label, onChange, pickOnMount }: ImageBlockViewProps) {
  const { t } = useTranslation();
  const [picking, setPicking] = useState<Picking>(pickOnMount ? "add" : null);
  const [shownId, setShownId] = useState<string | null>(block.images[0]?.id ?? null);
  // Announced after a change made with the arrows or the buttons.
  const [announce, setAnnounce] = useState("");
  // The image is gone if the media library no longer has it (deleted while
  // still used here; the WebView may still show it from its cache), or if
  // its file cannot be read.
  const library = useAssets({ kind: "image", search: null });
  const [failed, setFailed] = useState<string[]>([]);
  const captionId = useId();

  const images = block.images;
  const count = images.length;
  const index = Math.max(
    images.findIndex((image) => image.id === shownId),
    0,
  );
  const shown = images[index];
  const isMissing = (image: GalleryImage) =>
    failed.includes(image.assetId) ||
    (library.data !== undefined && !library.data.some((asset) => asset.id === image.assetId));

  const setImages = (next: GalleryImage[]) => onChange({ ...block, images: next });
  const show = (to: number, say = true) => {
    const target = images[Math.min(Math.max(to, 0), count - 1)];
    if (!target) return;
    setShownId(target.id);
    if (say) setAnnounce(position(target, images));
  };
  const position = (image: GalleryImage, list: GalleryImage[]) => {
    const at = list.findIndex((other) => other.id === image.id) + 1;
    return image.caption.trim()
      ? t("blocks.image.positionCaption", { index: at, count: list.length, caption: image.caption })
      : t("blocks.image.position", { index: at, count: list.length });
  };
  const add = (assetIds: string[]) => {
    const room = MAX_GALLERY_IMAGES - count;
    const added = assetIds.slice(0, room).map((assetId) => ({ id: newId(), assetId, caption: "" }));
    const first = added[0];
    if (!first) return;
    setImages([...images, ...added]);
    setShownId(first.id);
  };
  const replace = (assetId: string) => {
    if (!shown) return add([assetId]);
    setImages(images.map((image) => (image.id === shown.id ? { ...image, assetId } : image)));
  };
  const remove = (id: string) => {
    const at = images.findIndex((image) => image.id === id);
    const next = images.filter((image) => image.id !== id);
    setImages(next);
    if (id === shown?.id) setShownId(next[Math.min(at, next.length - 1)]?.id ?? null);
    setAnnounce(t("blocks.image.removed", { count: next.length }));
  };

  const addButton = (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => setPicking("add")}
      disabled={count >= MAX_GALLERY_IMAGES}
    >
      <ImagePlus />
      {count === 0 ? t("blocks.image.choose") : t("blocks.image.add")}
    </Button>
  );

  return (
    <figure
      aria-label={label}
      aria-roledescription={count > 1 ? t("blocks.image.gallery") : undefined}
      className="flex flex-col gap-2"
    >
      {!shown ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-6 text-sm text-muted-foreground">
          <ImagePlus aria-hidden className="size-6" />
          {t("blocks.image.empty")}
          {addButton}
        </div>
      ) : isMissing(shown) ? (
        <div
          role="alert"
          className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-destructive/40 py-6 text-sm text-muted-foreground"
        >
          <ImageOff aria-hidden className="size-6" />
          {t("blocks.image.missing")}
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setPicking("replace")}>
              <RefreshCw />
              {t("blocks.image.change")}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => remove(shown.id)}>
              <X />
              {t("blocks.image.remove")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="group relative self-start">
          <AssetImage
            assetId={shown.assetId}
            alt={shown.caption}
            onError={() => setFailed((current) => [...current, shown.assetId])}
            className="max-h-[28rem] max-w-full rounded-lg object-contain"
          />
          {count > 1 && (
            <>
              <Button
                variant="secondary"
                size="icon-sm"
                aria-label={t("blocks.image.previous")}
                disabled={index === 0}
                onClick={() => show(index - 1)}
                className="absolute top-1/2 left-2 -translate-y-1/2 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100 disabled:opacity-0"
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="secondary"
                size="icon-sm"
                aria-label={t("blocks.image.next")}
                disabled={index === count - 1}
                onClick={() => show(index + 1)}
                className="absolute top-1/2 right-2 -translate-y-1/2 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100 disabled:opacity-0"
              >
                <ChevronRight />
              </Button>
              <span
                aria-hidden
                className="absolute bottom-2 left-2 rounded-md bg-background/80 px-1.5 py-0.5 text-xs tabular-nums"
              >
                {t("blocks.image.counter", { index: index + 1, count })}
              </span>
            </>
          )}
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100">
            {addButton}
            <Button variant="secondary" size="sm" onClick={() => setPicking("replace")}>
              <RefreshCw />
              {t("blocks.image.change")}
            </Button>
            {count === 1 && (
              <Button
                variant="secondary"
                size="icon-sm"
                aria-label={t("blocks.image.removeOne", { index: 1 })}
                onClick={() => remove(shown.id)}
              >
                <X />
              </Button>
            )}
          </div>
        </div>
      )}
      {shown && !isMissing(shown) && (
        <figcaption>
          <label htmlFor={captionId} className="sr-only">
            {count > 1
              ? t("blocks.image.captionOf", { index: index + 1 })
              : t("blocks.image.caption")}
          </label>
          <Input
            id={captionId}
            value={shown.caption}
            maxLength={500}
            placeholder={t("blocks.image.captionPlaceholder")}
            onChange={(event) =>
              setImages(
                images.map((image) =>
                  image.id === shown.id ? { ...image, caption: event.target.value } : image,
                ),
              )
            }
            className="h-8 border-transparent bg-transparent px-1 text-sm text-muted-foreground shadow-none hover:border-border focus-visible:border-ring dark:bg-transparent"
          />
        </figcaption>
      )}
      {count > 1 && (
        <Thumbnails
          images={images}
          shownId={shown?.id ?? null}
          isMissing={isMissing}
          onShow={(id) => show(images.findIndex((image) => image.id === id))}
          onMove={(from, to) => setImages(move(images, from, to))}
          onRemove={remove}
          position={position}
        />
      )}
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
      <ImagePickerDialog
        multiple
        max={Math.max(MAX_GALLERY_IMAGES - count, 1)}
        open={picking === "add"}
        onOpenChange={(open) => setPicking(open ? "add" : null)}
        onPickMany={add}
      />
      <ImagePickerDialog
        open={picking === "replace"}
        onOpenChange={(open) => setPicking(open ? "replace" : null)}
        selectedId={shown?.assetId ?? null}
        onPick={replace}
      />
    </figure>
  );
}

type ThumbnailsProps = {
  images: GalleryImage[];
  shownId: string | null;
  isMissing: (image: GalleryImage) => boolean;
  onShow: (id: string) => void;
  onMove: (from: number, to: number) => void;
  onRemove: (id: string) => void;
  position: (image: GalleryImage, list: GalleryImage[]) => string;
};

/**
 * The gallery's thumbnails: a list where ← → move between them (showing
 * each), Space picks one up to reorder it, Delete removes it.
 */
function Thumbnails({
  images,
  shownId,
  isMissing,
  onShow,
  onMove,
  onRemove,
  position,
}: ThumbnailsProps) {
  const { t } = useTranslation();
  const listRef = useRef<HTMLUListElement>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
    }),
  );
  // A thumbnail over its own place right after being picked up is not announced.
  const lastOver = useRef<string | number | null>(null);
  const at = (id: string | number | undefined) => {
    const index = images.findIndex((image) => image.id === id);
    return { index: index + 1, count: images.length };
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    onMove(at(active.id).index - 1, at(over.id).index - 1);
  };
  const focusAt = (index: number) =>
    listRef.current?.querySelectorAll<HTMLElement>("[data-thumbnail]")[index]?.focus();

  const onKeyDown = (event: KeyboardEvent<HTMLElement>, image: GalleryImage) => {
    const index = images.findIndex((other) => other.id === image.id);
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      onRemove(image.id);
      requestAnimationFrame(() => focusAt(Math.min(index, images.length - 2)));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      onShow(image.id);
      return;
    }
    const moves: Record<string, number> = {
      ArrowLeft: index - 1,
      ArrowRight: index + 1,
      Home: 0,
      End: images.length - 1,
    };
    const to = moves[event.key];
    if (to === undefined) return;
    event.preventDefault();
    const target = images[Math.min(Math.max(to, 0), images.length - 1)];
    if (!target) return;
    onShow(target.id);
    focusAt(images.indexOf(target));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        screenReaderInstructions: { draggable: t("blocks.image.dragInstructions") },
        announcements: {
          onDragStart: ({ active }: { active: Active }) => {
            lastOver.current = active.id;
            return t("blocks.image.picked", at(active.id));
          },
          onDragOver: ({ over }: { active: Active; over: Over | null }) => {
            if (!over || over.id === lastOver.current) return undefined;
            lastOver.current = over.id;
            return t("blocks.image.over", at(over.id));
          },
          onDragMove: () => undefined,
          onDragEnd: ({ active, over }: { active: Active; over: Over | null }) =>
            t("blocks.image.dropped", at(over?.id ?? active.id)),
          onDragCancel: ({ active }: { active: Active }) =>
            t("blocks.image.cancelled", at(active.id)),
        },
      }}
    >
      <SortableContext
        items={images.map((image) => image.id)}
        strategy={horizontalListSortingStrategy}
      >
        <ul
          ref={listRef}
          aria-label={t("blocks.image.thumbnails")}
          className="scrollbar-thin flex gap-1.5 overflow-x-auto p-1"
        >
          {images.map((image) => (
            <Thumbnail
              key={image.id}
              image={image}
              label={position(image, images)}
              isShown={image.id === shownId}
              isMissing={isMissing(image)}
              onShow={() => onShow(image.id)}
              onRemove={() => onRemove(image.id)}
              onKeyDown={(event) => onKeyDown(event, image)}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function Thumbnail({
  image,
  label,
  isShown,
  isMissing,
  onShow,
  onRemove,
  onKeyDown,
}: {
  image: GalleryImage;
  label: string;
  isShown: boolean;
  isMissing: boolean;
  onShow: () => void;
  onRemove: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: image.id,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("group/thumb relative shrink-0", isDragging && "z-10 opacity-80")}
    >
      <button
        type="button"
        data-thumbnail
        {...attributes}
        {...listeners}
        // One stop of Tab for the list: the shown thumbnail.
        tabIndex={isShown ? 0 : -1}
        aria-label={label}
        aria-current={isShown ? "true" : undefined}
        onClick={onShow}
        onKeyDown={(event) => {
          listeners?.onKeyDown?.(event);
          // While picked up, the arrows move the thumbnail (dnd-kit).
          if (!isDragging && !event.defaultPrevented) onKeyDown(event);
        }}
        className={cn(
          "block size-14 cursor-grab overflow-hidden rounded-md bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          isShown ? "ring-2 ring-primary" : "opacity-70 hover:opacity-100",
        )}
      >
        {isMissing ? (
          <ImageOff aria-hidden className="m-auto size-5 text-muted-foreground" />
        ) : (
          <AssetImage assetId={image.assetId} alt="" className="size-full object-cover" />
        )}
      </button>
      <Button
        variant="secondary"
        size="icon-xs"
        tabIndex={-1}
        aria-label={t("blocks.image.removeThis", { label })}
        onClick={onRemove}
        className="absolute -top-1 -right-1 rounded-full opacity-0 transition group-hover/thumb:opacity-100"
      >
        <X />
      </Button>
    </li>
  );
}
