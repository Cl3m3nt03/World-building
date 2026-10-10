import { MessageSquareText } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { StoryNote, StoryOutline } from "@/lib/bindings";
import { useStoryNotes } from "./useNotes";

/** Characters of a note shown in the list. */
const SNIPPET = 80;

/**
 * The notes of a story, by chapter (in the left column until the world
 * panel's Home tab, 9.7). A note opens its passage.
 */
export function NotesList({
  outline,
  onOpen,
}: {
  outline: StoryOutline;
  onOpen: (note: StoryNote) => void;
}) {
  const { t } = useTranslation();
  const notes = useStoryNotes(outline.story.id);
  const all = notes.data ?? [];
  if (all.length === 0) return null;
  const chapters = outline.chapters.filter((chapter) =>
    all.some((note) => note.chapterId === chapter.id),
  );
  return (
    <section aria-labelledby="notes-title" className="flex flex-col gap-1.5">
      <h2 id="notes-title" className="text-xs font-bold text-muted-foreground">
        {t("quill.notes.title", { count: all.length })}
      </h2>
      {chapters.map((chapter) => (
        <div key={chapter.id} className="flex flex-col gap-0.5">
          <p className="truncate px-1 text-xs font-medium">{chapter.title}</p>
          <ul className="flex flex-col gap-0.5">
            {all
              .filter((note) => note.chapterId === chapter.id)
              .map((note) => {
                const body = note.body.trim() || t("quill.notes.empty");
                return (
                  <li key={note.id}>
                    <button
                      type="button"
                      onClick={() => onOpen(note)}
                      className="flex w-full items-start gap-1.5 rounded-md px-2 py-1 text-left text-xs outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <MessageSquareText
                        aria-hidden
                        className="mt-0.5 size-3 shrink-0 text-primary"
                      />
                      <span className="line-clamp-2">
                        {body.length > SNIPPET ? `${body.slice(0, SNIPPET)}…` : body}
                        {note.draftId !== chapter.currentDraftId && (
                          <span className="text-muted-foreground">
                            {t("quill.notes.inDraft", { name: note.draftName })}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
    </section>
  );
}
