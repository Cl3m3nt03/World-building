import { useParams } from "@tanstack/react-router";
import {
  ExternalLink,
  GripHorizontal,
  Images,
  MessageSquareText,
  Plus,
  Share2,
  SquareUser,
  X,
} from "lucide-react";
import { type KeyboardEvent, type PointerEvent, type ReactNode, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CardPicker, useCardList } from "@/features/cards";
import { HomeGraphPreview } from "@/features/graphs";
import { AssetImage, ImagePickerDialog } from "@/features/media";
import { useStoryOutline } from "../hooks/useQuill";
import { NotesList } from "../notes/NotesList";
import { CardSummary } from "../world/CardSummary";
import {
  BLOCK_SIZE,
  type BlockKind,
  type HomeBlock,
  moved,
  newBlockPlace,
  resized,
} from "./layout";
import { usePanelWorld } from "./PanelContext";

/** One step of a block moved or resized with the keyboard, in px. */
const KEY_STEP = 16;

/** Most images on a mood board. */
const MAX_MOODBOARD = 30;

/**
 * The world panel's Home tab: blocks laid out freely (cards, notes, mood
 * boards, the world's graph), moved by their top bar and resized by their
 * corner, with the pointer or the keyboard (arrows move, Shift+arrows
 * resize, from the bar).
 */
export function HomeBoard() {
  const { t } = useTranslation();
  const { layout, update } = usePanelWorld();
  const [pickingCard, setPickingCard] = useState(false);
  const choosingCard = useRef(false);
  const blocks = layout.blocks;

  const add = (kind: BlockKind, extra: Partial<HomeBlock> = {}) =>
    update((current) => ({
      ...current,
      blocks: [
        ...current.blocks,
        {
          id: crypto.randomUUID(),
          kind,
          ...newBlockPlace(current.blocks),
          ...BLOCK_SIZE[kind],
          ...(kind === "moodboard" ? { assetIds: [] } : {}),
          ...extra,
        },
      ],
    }));
  const change = (id: string, next: (item: HomeBlock) => HomeBlock) =>
    update((current) => ({
      ...current,
      blocks: current.blocks.map((item) => (item.id === id ? next(item) : item)),
    }));
  const remove = (id: string) =>
    update((current) => ({ ...current, blocks: current.blocks.filter((item) => item.id !== id) }));

  return (
    <section aria-label={t("quill.panel.home")} className="flex h-full flex-col gap-2 p-2">
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm">
              <Plus />
              {t("quill.panel.addBlock")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            // Going on to the card picker: the focus must not come back to
            // the menu's button, which would close the picker at once.
            onCloseAutoFocus={(event) => {
              if (choosingCard.current) event.preventDefault();
            }}
          >
            <DropdownMenuItem
              onSelect={() => {
                choosingCard.current = true;
                setPickingCard(true);
              }}
            >
              <SquareUser />
              {t("quill.panel.block.card")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => add("notes")}>
              <MessageSquareText />
              {t("quill.panel.block.notes")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => add("moodboard")}>
              <Images />
              {t("quill.panel.block.moodboard")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => add("graph")}>
              <Share2 />
              {t("quill.panel.block.graph")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <CardPicker
          open={pickingCard}
          onOpenChange={(open) => {
            if (!open) choosingCard.current = false;
            setPickingCard(open);
          }}
          label={t("quill.panel.pickCard")}
          allowedTypeIds={[]}
          onPick={(cardId) => {
            add("card", { cardId });
            setPickingCard(false);
          }}
        >
          <span aria-hidden className="size-0" />
        </CardPicker>
      </div>
      {blocks.length === 0 ? (
        <p className="p-4 text-center text-sm text-muted-foreground">
          {t("quill.panel.homeEmpty")}
        </p>
      ) : (
        <div className="scrollbar-thin relative min-h-0 flex-1 overflow-auto">
          <ul
            aria-label={t("quill.panel.blocks")}
            className="relative"
            style={{
              width: Math.max(...blocks.map((item) => item.x + item.w)) + 8,
              height: Math.max(...blocks.map((item) => item.y + item.h)) + 8,
            }}
          >
            {blocks.map((item) => (
              <Block
                key={item.id}
                block={item}
                onChange={(next) => change(item.id, next)}
                onRemove={() => remove(item.id)}
              />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Block({
  block,
  onChange,
  onRemove,
}: {
  block: HomeBlock;
  onChange: (next: (item: HomeBlock) => HomeBlock) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const cards = useCardList(false);
  const drag = useRef<{ x: number; y: number; mode: "move" | "resize" } | null>(null);
  const title =
    block.kind === "card"
      ? (cards.data?.find((card) => card.id === block.cardId)?.title ?? t("quill.panel.block.card"))
      : t(`quill.panel.block.${block.kind}`);

  const start = (mode: "move" | "resize") => (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, mode };
  };
  const follow = (event: PointerEvent<HTMLElement>) => {
    const from = drag.current;
    if (!from) return;
    const dx = event.clientX - from.x;
    const dy = event.clientY - from.y;
    if (dx === 0 && dy === 0) return;
    drag.current = { ...from, x: event.clientX, y: event.clientY };
    onChange((item) => (from.mode === "move" ? moved(item, dx, dy) : resized(item, dx, dy)));
  };
  const stop = () => {
    drag.current = null;
  };
  const keys = (event: KeyboardEvent<HTMLButtonElement>) => {
    const steps: Record<string, [number, number]> = {
      ArrowLeft: [-KEY_STEP, 0],
      ArrowRight: [KEY_STEP, 0],
      ArrowUp: [0, -KEY_STEP],
      ArrowDown: [0, KEY_STEP],
    };
    const step = steps[event.key];
    if (!step) return;
    event.preventDefault();
    onChange((item) =>
      event.shiftKey ? resized(item, step[0], step[1]) : moved(item, step[0], step[1]),
    );
  };

  return (
    <li
      aria-label={title}
      className="glass absolute flex flex-col overflow-hidden rounded-lg"
      style={{ left: block.x, top: block.y, width: block.w, height: block.h }}
    >
      <div className="flex shrink-0 items-center gap-1 border-b border-border px-1 py-0.5">
        <button
          type="button"
          aria-label={t("quill.panel.moveBlock", { name: title })}
          aria-describedby="quill-block-keys"
          onPointerDown={start("move")}
          onPointerMove={follow}
          onPointerUp={stop}
          onKeyDown={keys}
          className="flex min-w-0 flex-1 cursor-grab items-center gap-1 rounded px-1 py-0.5 text-xs font-medium outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
        >
          <GripHorizontal aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{title}</span>
        </button>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={t("quill.panel.removeBlock", { name: title })}
          onClick={onRemove}
        >
          <X />
        </Button>
      </div>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-auto p-2">
        <BlockBody block={block} onChange={onChange} />
      </div>
      <span
        aria-hidden
        onPointerDown={start("resize")}
        onPointerMove={follow}
        onPointerUp={stop}
        className="absolute right-0 bottom-0 size-3 cursor-se-resize"
      />
      <span id="quill-block-keys" className="sr-only">
        {t("quill.panel.blockKeys")}
      </span>
    </li>
  );
}

function BlockBody({
  block,
  onChange,
}: {
  block: HomeBlock;
  onChange: (next: (item: HomeBlock) => HomeBlock) => void;
}): ReactNode {
  const { t } = useTranslation();
  const { worldId } = useParams({ from: "/world/$worldId" });
  const world = usePanelWorld();
  const outline = useStoryOutline(world.storyId);
  const [picking, setPicking] = useState(false);

  if (block.kind === "card" && block.cardId) {
    const cardId = block.cardId;
    return (
      <div className="flex flex-col gap-2">
        <CardSummary cardId={cardId} />
        <Button
          variant="secondary"
          size="xs"
          className="self-start"
          onClick={() => world.openCard(cardId)}
        >
          <ExternalLink />
          {t("quill.panel.openCard")}
        </Button>
      </div>
    );
  }
  if (block.kind === "notes") {
    return outline.data ? (
      <NotesList
        outline={outline.data}
        onOpen={world.openNote}
        emptyText={t("quill.panel.noNotes")}
      />
    ) : null;
  }
  if (block.kind === "graph") {
    return (
      <div className="h-full min-h-40">
        <HomeGraphPreview worldId={worldId} onOpen={world.openCard} />
      </div>
    );
  }
  const images = block.assetIds ?? [];
  return (
    <div className="flex flex-col gap-2">
      {images.length > 0 && (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(5rem,1fr))] gap-1.5">
          {images.map((id) => (
            <li key={id} className="group relative">
              <AssetImage
                assetId={id}
                alt=""
                className="aspect-square w-full rounded-md object-cover"
              />
              <Button
                variant="secondary"
                size="icon-xs"
                aria-label={t("quill.panel.removeImage")}
                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                onClick={() =>
                  onChange((item) => ({
                    ...item,
                    assetIds: (item.assetIds ?? []).filter((other) => other !== id),
                  }))
                }
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Button
        variant="ghost"
        size="xs"
        className="self-start"
        disabled={images.length >= MAX_MOODBOARD}
        onClick={() => setPicking(true)}
      >
        <Images />
        {t("quill.panel.addImages")}
      </Button>
      <ImagePickerDialog
        multiple
        max={MAX_MOODBOARD - images.length}
        open={picking}
        onOpenChange={setPicking}
        title={t("quill.panel.addImages")}
        onPickMany={(ids) =>
          onChange((item) => ({
            ...item,
            assetIds: [...(item.assetIds ?? []), ...ids.filter((id) => !images.includes(id))],
          }))
        }
      />
    </div>
  );
}
