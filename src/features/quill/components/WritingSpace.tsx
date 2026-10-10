import { useParams } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import { AssetImage, ImagePickerDialog } from "@/features/media";
import { type Chapter, commands } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";
import { ChapterEditor } from "../editor/ChapterEditor";
import { useChapterChange, useStoryOutline } from "../hooks/useQuill";
import { ChapterList } from "./ChapterList";

/**
 * The writing space (docs/features/08-quill.md): the story's chapters on the
 * left, the chapter in the middle (header image, title, text), and the words
 * of the chapter and of the story. The world panel comes on the right (9.7).
 */
export function WritingSpace() {
  const { storyId, chapterId } = useParams({
    from: "/world/$worldId/quill/story/$storyId/chapter/$chapterId",
  });
  const outline = useStoryOutline(storyId);

  if (outline.error) {
    return (
      <div className="p-6">
        <AppErrorMessage error={outline.error} />
      </div>
    );
  }
  if (!outline.data) return null;
  const chapter = outline.data.chapters.find((candidate) => candidate.id === chapterId);

  return (
    <div className="glass grid h-full grid-cols-[15rem_minmax(0,1fr)] gap-6 rounded-lg p-4">
      <ChapterList outline={outline.data} currentId={chapterId} />
      {chapter ? (
        <ChapterView key={chapter.id} chapter={chapter} storyWords={outline.data.story.wordCount} />
      ) : null}
    </div>
  );
}

function ChapterView({ chapter, storyWords }: { chapter: Chapter; storyWords: number }) {
  const { t } = useTranslation();
  const [words, setWords] = useState(chapter.wordCount);
  const [picking, setPicking] = useState(false);
  const header = useChapterChange((assetId: string | null) =>
    unwrap(commands.setChapterHeader(chapter.id, assetId)),
  );
  // The story's words: the others as saved, this one as typed.
  const total = storyWords - chapter.wordCount + words;

  return (
    <article aria-label={chapter.title} className="flex min-h-0 flex-col">
      <div className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-2">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          {chapter.headerAssetId && (
            <div className="group relative">
              <AssetImage
                assetId={chapter.headerAssetId}
                alt={t("quill.header.alt")}
                className="aspect-[4/1] w-full rounded-lg object-cover"
              />
              <Button
                variant="secondary"
                size="icon-xs"
                aria-label={t("quill.header.remove")}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                onClick={() => header.mutate(null)}
              >
                <X />
              </Button>
            </div>
          )}
          <ChapterTitle chapter={chapter} />
          {header.error && <AppErrorMessage error={header.error} />}
          <ChapterEditor
            storyId={chapter.storyId}
            draftId={chapter.currentDraftId}
            onWords={setWords}
            onHeader={() => setPicking(true)}
          />
        </div>
      </div>
      <p
        role="status"
        aria-live="off"
        className="shrink-0 border-t border-border pt-2 text-center text-xs text-muted-foreground"
      >
        {t("quill.wordCounts", { chapter: words, story: total })}
      </p>
      <ImagePickerDialog
        open={picking}
        onOpenChange={setPicking}
        title={t("quill.toolbar.header")}
        selectedId={chapter.headerAssetId}
        onPick={(assetId) => header.mutate(assetId)}
      />
    </article>
  );
}

/** The chapter's title, written in place over its text. */
function ChapterTitle({ chapter }: { chapter: Chapter }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(chapter.title);
  const rename = useChapterChange((value: string) =>
    unwrap(commands.renameChapter(chapter.id, value)),
  );
  useEffect(() => setTitle(chapter.title), [chapter.title]);
  const commit = () => {
    const value = title.trim();
    if (value === "") setTitle(chapter.title);
    else if (value !== chapter.title) rename.mutate(value);
  };
  return (
    <div className="flex flex-col gap-1">
      <input
        aria-label={t("quill.chapterName")}
        value={title}
        maxLength={200}
        onChange={(event) => setTitle(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            setTitle(chapter.title);
            event.currentTarget.blur();
          }
        }}
        className="w-full rounded-md border border-transparent bg-transparent px-2 text-center font-heading text-3xl font-bold outline-none hover:border-border focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      {rename.error && <AppErrorMessage error={rename.error} />}
    </div>
  );
}
