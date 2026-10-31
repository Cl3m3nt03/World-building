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
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { type Chapter, commands, type StoryNote, type StoryOutline } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";
import { cn } from "@/lib/utils";
import { DraftList } from "../drafts/DraftList";
import { useChapterChange } from "../hooks/useQuill";
import { NotesList } from "../notes/NotesList";
import { readMode } from "./ModeBar";

type Props = {
  outline: StoryOutline;
  currentId: string;
  /** The draft shown in the editor. */
  openDraftId: string;
  /** Opens a note's passage. */
  onOpenNote: (note: StoryNote) => void;
};

/**
 * The writing space's left column: the story and its chapters, created,
 * renamed, reordered (drag, or Space then arrows) and deleted.
 */
export function ChapterList({ outline, currentId, openDraftId, onOpenNote }: Props) {
  const { t } = useTranslation();
  const { worldId } = useParams({ from: "/world/$worldId" });
  const navigate = useNavigate();
  const storyId = outline.story.id;
  const chapters = outline.chapters;
  const [renaming, setRenaming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Chapter | null>(null);
  const lastOver = useRef<string | number | null>(null);
  const create = useChapterChange(() =>
    unwrap(
      commands.createChapter(
        storyId,
        t("quill.defaultChapter", { number: chapters.length + 1 }),
        t("quill.defaultDraft", { number: 1 }),
      ),
    ),
  );
  const move = useChapterChange(({ id, index }: { id: string; index: number }) =>
    unwrap(commands.moveChapter(id, index)),
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
    }),
  );
  const at = (id: string | number | undefined) => {
    const index = chapters.findIndex((chapter) => chapter.id === id);
    return { name: chapters[index]?.title ?? "", position: index + 1, count: chapters.length };
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const index = chapters.findIndex((chapter) => chapter.id === over.id);
    if (index >= 0) move.mutate({ id: String(active.id), index });
  };
  const error = create.error ?? move.error;

  return (
    <nav aria-labelledby="chapters-title" className="flex min-h-0 flex-col gap-3">
      <Link
        to="/world/$worldId/quill"
        params={{ worldId }}
        className="flex items-center gap-1.5 self-start rounded text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {t("quill.title")}
      </Link>
      <div>
        <p className="font-heading text-lg font-bold">{outline.story.title}</p>
        <p className="text-xs text-muted-foreground">
          {t("quill.counts", {
            count: chapters.length,
            chapters: chapters.length,
            words: outline.story.wordCount,
          })}
        </p>
      </div>
      <h2 id="chapters-title" className="rubric">
        {t("quill.chapters")}
      </h2>
      {error && <AppErrorMessage error={error} />}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        accessibility={{
          screenReaderInstructions: { draggable: t("quill.chapterDrag.instructions") },
          announcements: {
            onDragStart: ({ active }: { active: Active }) => {
              lastOver.current = active.id;
              return t("quill.chapterDrag.picked", at(active.id));
            },
            onDragOver: ({ active, over }: { active: Active; over: Over | null }) => {
              if (!over || over.id === lastOver.current) return undefined;
              lastOver.current = over.id;
              return t("quill.chapterDrag.over", { ...at(over.id), name: at(active.id).name });
            },
            onDragMove: () => undefined,
            onDragEnd: ({ active, over }: { active: Active; over: Over | null }) =>
              t("quill.chapterDrag.dropped", {
                ...at(over?.id ?? active.id),
                name: at(active.id).name,
              }),
            onDragCancel: ({ active }: { active: Active }) =>
              t("quill.chapterDrag.cancelled", at(active.id)),
          },
        }}
      >
        <SortableContext
          items={chapters.map((chapter) => chapter.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul
            aria-labelledby="chapters-title"
            className="flex min-h-0 flex-col gap-0.5 overflow-y-auto"
          >
            {chapters.map((chapter) => (
              <ChapterRow
                key={chapter.id}
                chapter={chapter}
                current={chapter.id === currentId}
                openDraftId={openDraftId}
                renaming={renaming === chapter.id}
                onRename={() => setRenaming(chapter.id)}
                onRenamed={() => setRenaming(null)}
                onDelete={chapters.length > 1 ? () => setDeleting(chapter) : null}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        disabled={create.isPending}
        onClick={() =>
          create.mutate(undefined, {
            onSuccess: (chapter) => {
              if ("drafts" in chapter) {
                void navigate({
                  to: "/world/$worldId/quill/story/$storyId/chapter/$chapterId",
                  params: { worldId, storyId, chapterId: chapter.id },
                });
              }
            },
          })
        }
      >
        <Plus />
        {t("quill.newChapter")}
      </Button>
      <NotesList outline={outline} onOpen={onOpenNote} />
      <DeleteChapterDialog
        chapter={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={(next) => {
          setDeleting(null);
          if (deleting?.id === currentId && next) {
            void navigate({
              to: "/world/$worldId/quill/story/$storyId/chapter/$chapterId",
              params: { worldId, storyId, chapterId: next },
            });
          }
        }}
      />
    </nav>
  );
}

function ChapterRow({
  chapter,
  current,
  openDraftId,
  renaming,
  onRename,
  onRenamed,
  onDelete,
}: {
  chapter: Chapter;
  current: boolean;
  openDraftId: string;
  renaming: boolean;
  onRename: () => void;
  onRenamed: () => void;
  onDelete: (() => void) | null;
}) {
  const { t } = useTranslation();
  const { worldId } = useParams({ from: "/world/$worldId" });
  const sortable = useSortable({ id: chapter.id });
  const rename = useChapterChange((title: string) =>
    unwrap(commands.renameChapter(chapter.id, title)),
  );
  return (
    <li
      ref={sortable.setNodeRef}
      style={{
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
      }}
      className={cn("flex flex-col gap-1", sortable.isDragging && "relative z-10 opacity-70")}
    >
      <div className="group flex items-center gap-1">
        {renaming ? (
          <Input
            aria-label={t("quill.chapterName")}
            defaultValue={chapter.title}
            maxLength={200}
            autoFocus
            onFocus={(event) => event.currentTarget.select()}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") {
                event.currentTarget.value = chapter.title;
                event.currentTarget.blur();
              }
            }}
            onBlur={(event) => {
              const title = event.currentTarget.value.trim();
              if (title && title !== chapter.title) rename.mutate(title);
              onRenamed();
            }}
            className="h-8"
          />
        ) : (
          <Link
            to="/world/$worldId/quill/story/$storyId/chapter/$chapterId"
            params={{ worldId, storyId: chapter.storyId, chapterId: chapter.id }}
            // Another chapter opens in the same mode (writing, publishing…).
            search={(previous: { mode?: unknown }) => {
              const mode = readMode(previous.mode);
              return mode === "write" ? {} : { mode };
            }}
            {...sortable.listeners}
            aria-describedby={sortable.attributes["aria-describedby"]}
            aria-current={current ? "page" : undefined}
            onDoubleClick={onRename}
            className="flex min-w-0 flex-1 flex-col rounded-md px-2 py-1.5 text-sm outline-none select-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:bg-accent aria-[current=page]:font-medium"
          >
            <span className="truncate">{chapter.title}</span>
            <span className="text-xs font-normal text-muted-foreground">
              {t("quill.words", { count: chapter.wordCount })}
            </span>
          </Link>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={t("quill.chapterActions", { name: chapter.title })}
              className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onRename}>
              <Pencil />
              {t("quill.renameChapter")}
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              disabled={!onDelete}
              onSelect={() => onDelete?.()}
            >
              <Trash2 />
              {t("quill.deleteChapter")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {current && <DraftList chapter={chapter} openId={openDraftId} />}
    </li>
  );
}

/** Deleting a chapter is for good: it is asked first. */
function DeleteChapterDialog({
  chapter,
  onClose,
  onDeleted,
}: {
  chapter: Chapter | null;
  onClose: () => void;
  /** With the chapter to open instead, if any. */
  onDeleted: (next: string | null) => void;
}) {
  const { t } = useTranslation();
  const remove = useChapterChange((id: string) => unwrap(commands.deleteChapter(id)));
  return (
    <Dialog
      open={chapter !== null}
      onOpenChange={(open) => {
        if (!open) {
          remove.reset();
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("quill.deleteChapterTitle", { name: chapter?.title ?? "" })}</DialogTitle>
          <DialogDescription>
            {t("quill.deleteChapterDescription", {
              count: chapter?.drafts.length ?? 0,
              words: chapter?.wordCount ?? 0,
            })}
          </DialogDescription>
        </DialogHeader>
        {remove.error && <AppErrorMessage error={remove.error} />}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("quill.cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={remove.isPending}
            onClick={() =>
              chapter &&
              remove.mutate(chapter.id, {
                onSuccess: (outline) =>
                  onDeleted("chapters" in outline ? (outline.chapters[0]?.id ?? null) : null),
              })
            }
          >
            <Trash2 />
            {t("quill.deleteConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
