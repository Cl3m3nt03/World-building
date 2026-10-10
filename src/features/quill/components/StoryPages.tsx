import { Navigate, useNavigate, useParams } from "@tanstack/react-router";
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
