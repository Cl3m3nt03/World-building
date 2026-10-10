import { Link, Navigate, useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { useCreateStory, useStoryOutline, useUpdateStory } from "../hooks/useQuill";
import { DEFAULT_STORY, StoryForm } from "./StoryForm";

/** « Nouvelle histoire »: the book is set up, then « Chapitre 1 » opens. */
export function NewStoryPage() {
  const { t } = useTranslation();
  const { worldId } = useParams({ from: "/world/$worldId" });
  const navigate = useNavigate();
  const create = useCreateStory();
  return (
    <StoryForm
      mode="create"
      initial={DEFAULT_STORY}
      pending={create.isPending}
      error={create.error}
      onCancel={() => void navigate({ to: "/world/$worldId/quill", params: { worldId } })}
      onSubmit={(value) =>
        create.mutate(
          {
            ...value,
            chapterTitle: t("quill.defaultChapter", { number: 1 }),
            draftName: t("quill.defaultDraft", { number: 1 }),
          },
          {
            onSuccess: (outline) => {
              const chapter = outline.chapters[0];
              void navigate(
                chapter
                  ? {
                      to: "/world/$worldId/quill/story/$storyId/chapter/$chapterId",
                      params: { worldId, storyId: outline.story.id, chapterId: chapter.id },
                    }
                  : { to: "/world/$worldId/quill", params: { worldId } },
              );
            },
          },
        )
      }
    />
  );
}

/** The book of an existing story, changed. */
export function EditStoryPage() {
  const { worldId, storyId } = useParams({ from: "/world/$worldId/quill/story/$storyId/edit" });
  const navigate = useNavigate();
  const outline = useStoryOutline(storyId);
  const update = useUpdateStory();
  if (outline.error) return <AppErrorMessage error={outline.error} />;
  if (!outline.data) return null;
  const { story } = outline.data;
  const back = () => void navigate({ to: "/world/$worldId/quill", params: { worldId } });
  return (
    <StoryForm
      mode="edit"
      initial={{ title: story.title, bookStyle: story.bookStyle, cover: story.cover }}
      pending={update.isPending}
      error={update.error}
      onCancel={back}
      onSubmit={(value) => update.mutate({ id: storyId, patch: value }, { onSuccess: back })}
    />
  );
}

/** A story opens on its first chapter. */
export function StoryIndexPage() {
  const { worldId, storyId } = useParams({ from: "/world/$worldId/quill/story/$storyId" });
  const outline = useStoryOutline(storyId);
  if (outline.error) return <AppErrorMessage error={outline.error} />;
  const chapter = outline.data?.chapters[0];
  if (!chapter) return null;
  return (
    <Navigate
      to="/world/$worldId/quill/story/$storyId/chapter/$chapterId"
      params={{ worldId, storyId, chapterId: chapter.id }}
      replace
    />
  );
}

/**
 * A chapter of a story. Until the writing space (M9, 9.3): its story's
 * chapters and its title.
 */
export function ChapterPage() {
  const { t } = useTranslation();
  const { worldId, storyId, chapterId } = useParams({
    from: "/world/$worldId/quill/story/$storyId/chapter/$chapterId",
  });
  const outline = useStoryOutline(storyId);
  if (outline.error) return <AppErrorMessage error={outline.error} />;
  if (!outline.data) return null;
  const chapter = outline.data.chapters.find((candidate) => candidate.id === chapterId);
  return (
    <div className="glass flex h-full gap-6 rounded-lg p-6">
      <nav aria-label={t("quill.chapters")} className="flex w-56 shrink-0 flex-col gap-2">
        <Link
          to="/world/$worldId/quill"
          params={{ worldId }}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft aria-hidden className="size-4" />
          {t("quill.title")}
        </Link>
        <p className="font-heading font-bold">{outline.data.story.title}</p>
        <ul className="flex flex-col gap-1">
          {outline.data.chapters.map((item) => (
            <li key={item.id}>
              <Link
                to="/world/$worldId/quill/story/$storyId/chapter/$chapterId"
                params={{ worldId, storyId, chapterId: item.id }}
                aria-current={item.id === chapterId ? "page" : undefined}
                className="block rounded-md px-2 py-1 text-sm hover:bg-accent aria-[current=page]:bg-accent aria-[current=page]:font-medium"
              >
                {item.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <article aria-label={chapter?.title ?? ""} className="flex-1">
        <h1 className="text-center font-heading text-2xl font-bold">{chapter?.title}</h1>
      </article>
    </div>
  );
}
