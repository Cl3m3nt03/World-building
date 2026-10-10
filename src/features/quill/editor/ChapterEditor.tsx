import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EditorContent, type JSONContent, useEditor } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { useWorldInText, WorldInTextOverlay } from "@/features/cards";
import { ImagePickerDialog } from "@/features/media";
import { commands, type Draft, type DraftInfo, type StoryOutline } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";
import { usePendingSave } from "@/lib/pendingSaves";
import { quillKeys } from "../hooks/useQuill";
import { CardPreview } from "../world/CardPreview";
import { EditorToolbar } from "./EditorToolbar";
import { quillExtensions, type SlashCommand } from "./extensions";
import { createListStore } from "./listStore";
import { SelectionMenu } from "./SelectionMenu";
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
  /** Opens a card of the world next to the text. */
  onOpenCard: (cardId: string) => void;
};

/** The card named where the pointer is: a mention, or a name detected in the text. */
function cardIdAt(target: EventTarget | null): string | null {
  const element = target instanceof Element ? target : null;
  const detected = element?.closest(".entity-detected[data-card-id]");
  if (detected) return detected.getAttribute("data-card-id");
  const href = element?.closest("a.mention-link")?.getAttribute("href") ?? "";
  return href.startsWith("#card-") ? href.slice("#card-".length) : null;
}

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
export function ChapterEditor({ storyId, draftId, onWords, onHeader, onOpenCard }: Props) {
  const queryClient = useQueryClient();
  const draft = useQuery({
    queryKey: quillKeys.draft(draftId),
    queryFn: () => unwrap(commands.getDraft(draftId)),
    // The text being typed is the truth: never read again under it.
    staleTime: Number.POSITIVE_INFINITY,
  });
  const save = useMutation({
    mutationFn: (content: string) => unwrap(commands.saveDraft(draftId, content)),
    onSuccess: (saved, content) => {
      queryClient.setQueryData<Draft>(quillKeys.draft(draftId), (draft) =>
        draft ? { ...draft, content, wordCount: saved.wordCount } : draft,
      );
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
      onOpenCard={onOpenCard}
    />
  );
}

function LoadedEditor({
  initial,
  onSave,
  saveError,
  onWords,
  onHeader,
  onOpenCard,
}: {
  initial: string;
  onSave: (content: string) => Promise<void>;
  saveError: unknown;
  onWords: (words: number) => void;
  onHeader: () => void;
  onOpenCard: (cardId: string) => void;
}) {
  const { t } = useTranslation();
  const worldInText = useWorldInText("");
  const [preview, setPreview] = useState<{ cardId: string; rect: DOMRect } | null>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [slash] = useState(createListStore<SlashCommand>);
  const [picking, setPicking] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef<string | null>(null);
  const callbacks = useRef({ onSave, onWords, onOpenCard });
  callbacks.current = { onSave, onWords, onOpenCard };

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
    extensions: [
      ...quillExtensions({
        placeholder: t("quill.editor.placeholder"),
        slash,
        slashLabel: (command) => t(`quill.slash.${command}`),
        pickImage: () => setPicking(true),
      }),
      ...worldInText.extensions,
    ],
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
    onBlur: worldInText.hideChip,
    onCreate: ({ editor: created }) => callbacks.current.onWords(countWords(created.getText())),
    onUpdate: ({ editor: current }) => {
      callbacks.current.onWords(countWords(current.getText()));
      pending.current = JSON.stringify(current.getJSON());
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
    },
  });

  // A card's name in the text: its preview on hover, opened on click.
  useEffect(() => {
    const dom = editor?.view.dom;
    if (!dom) return;
    const over = (event: MouseEvent) => {
      const id = cardIdAt(event.target);
      clearTimeout(previewTimer.current);
      if (!id) {
        setPreview(null);
        return;
      }
      const rect = (event.target as Element).getBoundingClientRect();
      previewTimer.current = setTimeout(() => setPreview({ cardId: id, rect }), 350);
    };
    const leave = () => {
      clearTimeout(previewTimer.current);
      setPreview(null);
    };
    const click = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const id = target?.closest(".entity-detected[data-card-id]")?.getAttribute("data-card-id");
      if (id) callbacks.current.onOpenCard(id);
    };
    dom.addEventListener("mouseover", over);
    dom.addEventListener("mouseleave", leave);
    dom.addEventListener("click", click);
    return () => {
      clearTimeout(previewTimer.current);
      dom.removeEventListener("mouseover", over);
      dom.removeEventListener("mouseleave", leave);
      dom.removeEventListener("click", click);
    };
  }, [editor]);

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
      {preview && <CardPreview cardId={preview.cardId} rect={preview.rect} />}
      <WorldInTextOverlay editor={editor} overlay={worldInText.overlay} />
      <SelectionMenu editor={editor} />
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
