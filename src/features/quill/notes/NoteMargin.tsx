import { type Editor, useEditorState } from "@tiptap/react";
import { MessageSquareText, Trash2 } from "lucide-react";
import { type RefObject, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { StoryNote } from "@/lib/bindings";
import { notePositions, removeNoteMark } from "./noteMark";
import { useDeleteNote, useUpdateNote } from "./useNotes";

/** Characters of a note shown in its icon's name. */
const SNIPPET = 60;

type Props = {
  editor: Editor;
  storyId: string;
  /** The notes of the draft shown. */
  notes: StoryNote[];
  /** The box the icons are placed in (the text's column). */
  box: RefObject<HTMLDivElement | null>;
  openId: string | null;
  onOpen: (id: string | null) => void;
};

/**
 * The notes of a text, in its right margin: an icon at the height of each
 * annotated passage, which opens the note to read, change or delete it.
 */
export function NoteMargin({ editor, storyId, notes, box, openId, onOpen }: Props) {
  const { t } = useTranslation();
  const positions = useEditorState({
    editor,
    selector: ({ editor: current }) => notePositions(current),
    equalityFn: (a, b) =>
      b !== null && a.length === b.length && a.every((item, index) => item.from === b[index]?.from),
  });
  // Heights follow the layout: read again when the box changes size.
  const [, setTick] = useState(0);
  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setTick((tick) => tick + 1));
    observer.observe(element);
    return () => observer.disconnect();
  }, [box]);

  const top = (from: number) => {
    const element = box.current;
    if (!element || editor.isDestroyed) return 0;
    try {
      return editor.view.coordsAtPos(from).top - element.getBoundingClientRect().top;
    } catch {
      return 0;
    }
  };

  return (
    <>
      {positions.map(({ noteId, from }) => {
        const note = notes.find((candidate) => candidate.id === noteId);
        if (!note) return null;
        const snippet = note.body.trim() || t("quill.notes.empty");
        return (
          <Popover
            key={noteId}
            open={openId === noteId}
            onOpenChange={(open) => onOpen(open ? noteId : null)}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={t("quill.notes.open", {
                  note: snippet.length > SNIPPET ? `${snippet.slice(0, SNIPPET)}…` : snippet,
                })}
                className="absolute -right-8 flex size-7 items-center justify-center rounded-md text-primary outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
                style={{ top: top(from) }}
              >
                <MessageSquareText aria-hidden className="size-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="left" align="start" className="w-72 p-3">
              <NoteEditor
                editor={editor}
                storyId={storyId}
                note={note}
                onDeleted={() => onOpen(null)}
              />
            </PopoverContent>
          </Popover>
        );
      })}
    </>
  );
}

function NoteEditor({
  editor,
  storyId,
  note,
  onDeleted,
}: {
  editor: Editor;
  storyId: string;
  note: StoryNote;
  onDeleted: () => void;
}) {
  const { t } = useTranslation();
  const [body, setBody] = useState(note.body);
  const update = useUpdateNote(storyId);
  const remove = useDeleteNote(storyId);
  const save = () => {
    if (body !== note.body) update.mutate({ id: note.id, body });
  };
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={`note-${note.id}`} className="text-xs font-bold text-muted-foreground">
        {t("quill.notes.label")}
      </label>
      <textarea
        id={`note-${note.id}`}
        value={body}
        maxLength={20000}
        rows={5}
        placeholder={t("quill.notes.placeholder")}
        onChange={(event) => setBody(event.target.value)}
        onBlur={save}
        className="w-full resize-y rounded-md border border-input bg-transparent px-2 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      {(update.error ?? remove.error) && <AppErrorMessage error={update.error ?? remove.error} />}
      <div className="flex justify-between">
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive"
          disabled={remove.isPending}
          onClick={() =>
            remove.mutate(note.id, {
              onSuccess: () => {
                removeNoteMark(editor, note.id);
                onDeleted();
              },
            })
          }
        >
          <Trash2 />
          {t("quill.notes.delete")}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            save();
            onDeleted();
          }}
        >
          {t("quill.notes.done")}
        </Button>
      </div>
    </div>
  );
}
