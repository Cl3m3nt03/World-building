import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { BookPlus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
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
import type { Story } from "@/lib/bindings";
import { useDeleteStory, useStories } from "../hooks/useQuill";
import { BookCover } from "./BookCover";

/**
 * The Quill tab's first screen: the world's stories as books, each with its
 * chapters and words, and « Nouvelle histoire ».
 */
export function StoriesScreen() {
  const { t } = useTranslation();
  const { worldId } = useParams({ from: "/world/$worldId" });
  const stories = useStories();
  const [deleting, setDeleting] = useState<Story | null>(null);

  return (
    <main
      aria-labelledby="quill-title"
      className="glass flex h-full flex-col gap-6 overflow-y-auto rounded-lg p-6"
    >
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 id="quill-title" className="font-heading text-2xl font-bold">
            {t("quill.title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("quill.subtitle")}</p>
        </div>
        <Button asChild>
          <Link to="/world/$worldId/quill/new" params={{ worldId }}>
            <BookPlus />
            {t("quill.newStory")}
          </Link>
        </Button>
      </header>
      {stories.error && <AppErrorMessage error={stories.error} />}
      {stories.data?.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <BookPlus aria-hidden className="size-10 text-muted-foreground" />
          <p className="font-medium">{t("quill.empty.title")}</p>
          <p className="max-w-sm text-sm text-muted-foreground">{t("quill.empty.description")}</p>
        </div>
      ) : (
        <ul
          aria-labelledby="quill-title"
          className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-6"
        >
          {stories.data?.map((story) => (
            <StoryTile key={story.id} story={story} onDelete={() => setDeleting(story)} />
          ))}
        </ul>
      )}
      <DeleteStoryDialog story={deleting} onClose={() => setDeleting(null)} />
    </main>
  );
}

function StoryTile({ story, onDelete }: { story: Story; onDelete: () => void }) {
  const { t } = useTranslation();
  const { worldId } = useParams({ from: "/world/$worldId" });
  const navigate = useNavigate();
  return (
    <li className="group relative flex flex-col gap-2">
      <Link
        to="/world/$worldId/quill/story/$storyId"
        params={{ worldId, storyId: story.id }}
        className="flex flex-col gap-2 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <BookCover
          title={story.title}
          bookStyle={story.bookStyle}
          cover={story.cover}
          className="w-full transition group-hover:-translate-y-1 motion-reduce:transition-none"
        />
        <span className="truncate font-medium">{story.title}</span>
        <span className="text-xs text-muted-foreground">
          {t("quill.counts", {
            count: story.chapterCount,
            chapters: story.chapterCount,
            words: story.wordCount,
          })}
        </span>
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="secondary"
            size="icon-xs"
            className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
            aria-label={t("quill.storyActions", { name: story.title })}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() =>
              void navigate({
                to: "/world/$worldId/quill/story/$storyId/edit",
                params: { worldId, storyId: story.id },
              })
            }
          >
            <Pencil />
            {t("quill.editBook")}
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={onDelete}>
            <Trash2 />
            {t("quill.deleteStory")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

/** Deleting a story is for good: it is asked first. */
function DeleteStoryDialog({ story, onClose }: { story: Story | null; onClose: () => void }) {
  const { t } = useTranslation();
  const remove = useDeleteStory();
  return (
    <Dialog
      open={story !== null}
      onOpenChange={(open) => {
        if (!open) {
          remove.reset();
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("quill.deleteTitle", { name: story?.title ?? "" })}</DialogTitle>
          <DialogDescription>
            {t("quill.deleteDescription", {
              chapters: story?.chapterCount ?? 0,
              words: story?.wordCount ?? 0,
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
            onClick={() => story && remove.mutate(story.id, { onSuccess: onClose })}
          >
            <Trash2 />
            {t("quill.deleteConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
