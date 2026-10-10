import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EditorContent, type JSONContent, useEditor } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { ImagePickerDialog } from "@/features/media";
import { commands, type DraftInfo, type StoryOutline } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";
import { usePendingSave } from "@/lib/pendingSaves";
import { quillKeys } from "../hooks/useQuill";
import { EditorToolbar } from "./EditorToolbar";
import { quillExtensions, type SlashCommand } from "./extensions";
import { createListStore } from "./listStore";
import { SlashMenu } from "./SlashMenu";
import { countWords } from "./words";

/** Pause after the last change before the draft is saved. */
const SAVE_DELAY_MS = 500;

type Props = {
  storyId: string;
  draftId: string;
  /** The words of the text as it is typed (before it is saved). */
  onWords: (words: number) => void;
  /** Opens the chapter's header image picker. */
  onHeader: () => void;
};

/** The outline as a draft save left it: its words in its chapter and story. */
function withSaved(outline: StoryOutline, saved: DraftInfo): StoryOutline {
  let delta = 0;
  const chapters = outline.chapters.map((chapter) => {
    if (!chapter.drafts.some((draft) => draft.id === saved.id)) return chapter;
    const drafts = chapter.drafts.map((draft) => (draft.id === saved.id ? saved : draft));
    if (chapter.currentDraftId !== saved.id) return { ...chapter, drafts };
    delta = saved.wordCount - chapter.wordCount;
    return { ...chapter, drafts, wordCount: saved.wordCount };
  });
  return {
    story: { ...outline.story, wordCount: outline.story.wordCount + delta },
    chapters,
  };
}

/**
 * A chapter's text (its draft): the editor with its toolbar and "/"
 * commands. It is saved half a second after the last change, before the
 * world or the window closes, and Ctrl+Z undoes.
 */
export function ChapterEditor({ storyId, draftId, onWords, onHeader }: Props) {
  const queryClient = useQueryClient();
  const draft = useQuery({
    queryKey: quillKeys.draft(draftId),
    queryFn: () => unwrap(commands.getDraft(draftId)),
    // The text being typed is the truth: never read again under it.
    staleTime: Number.POSITIVE_INFINITY,
  });
  const save = useMutation({
    mutationFn: (content: string) => unwrap(commands.saveDraft(draftId, content)),
    onSuccess: (saved) => {
      queryClient.setQueryData<StoryOutline>(quillKeys.outline(storyId), (outline) =>
        outline ? withSaved(outline, saved) : outline,
      );
      void queryClient.invalidateQueries({ queryKey: quillKeys.stories() });
    },
  });

  if (draft.error) return <AppErrorMessage error={draft.error} />;
  if (!draft.data) return null;
  return (
    <LoadedEditor
      initial={draft.data.content}
      onSave={(content) => save.mutateAsync(content).then(() => undefined)}
      saveError={save.error}
      onWords={onWords}
      onHeader={onHeader}
    />
  );
}

function LoadedEditor({
  initial,
  onSave,
  saveError,
  onWords,
  onHeader,
}: {
  initial: string;
  onSave: (content: string) => Promise<void>;
  saveError: unknown;
  onWords: (words: number) => void;
  onHeader: () => void;
}) {
  const { t } = useTranslation();
  const [slash] = useState(createListStore<SlashCommand>);
  const [picking, setPicking] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef<string | null>(null);
  const callbacks = useRef({ onSave, onWords });
  callbacks.current = { onSave, onWords };

  const flush = () => {
    clearTimeout(timer.current);
    const content = pending.current;
    if (content === null) return undefined;
    pending.current = null;
    // A failure is shown under the text (`saveError`).
    return callbacks.current.onSave(content).catch(() => {});
  };
  usePendingSave(flush);

  const editor = useEditor({
    extensions: quillExtensions({
      placeholder: t("quill.editor.placeholder"),
      slash,
      slashLabel: (command) => t(`quill.slash.${command}`),
      pickImage: () => setPicking(true),
    }),
    content: JSON.parse(initial) as JSONContent,
    editorProps: {
      attributes: {
        "aria-label": t("quill.editor.label"),
        "aria-multiline": "true",
        role: "textbox",
        class:
          "prose-bz quill-text min-h-[50vh] rounded-md px-2 py-1 text-base leading-relaxed outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
      },
    },
    onCreate: ({ editor: created }) => callbacks.current.onWords(countWords(created.getText())),
    onUpdate: ({ editor: current }) => {
      callbacks.current.onWords(countWords(current.getText()));
      pending.current = JSON.stringify(current.getJSON());
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
    },
  });

  // Leaving the chapter saves what was typed.
  // biome-ignore lint/correctness/useExhaustiveDependencies: flush reads refs only
  useEffect(() => () => void flush(), []);

  if (!editor) return null;
  return (
    <div className="flex flex-col gap-3">
      <div className="sticky top-0 z-10">
        <EditorToolbar editor={editor} onImage={() => setPicking(true)} onHeader={onHeader} />
      </div>
      <EditorContent editor={editor} />
      {saveError ? <AppErrorMessage error={saveError} /> : null}
      <SlashMenu store={slash} />
      <ImagePickerDialog
        open={picking}
        onOpenChange={setPicking}
        title={t("quill.toolbar.image")}
        onPick={(assetId) =>
          editor.chain().focus().insertContent({ type: "image", attrs: { assetId } }).run()
        }
      />
    </div>
  );
}
