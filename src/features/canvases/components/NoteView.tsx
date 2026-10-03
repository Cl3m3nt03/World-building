import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { NOTE_INK, type Note, noteBackground } from "../notes";

type Props = {
  note: Note;
  /** Written in: its fields take the keyboard and the pointer. */
  editing: boolean;
  /** Each change while it is written (title or text). */
  onChange: (note: Note) => void;
  /** Done writing (Escape, or the pointer went elsewhere). */
  onDone: () => void;
};

/**
 * A note on a canvas (as on the board): coloured paper, plain or ruled, a
 * title and a text. Shown, it only draws (the pointer goes to Excalidraw,
 * which moves it); written in, its title and text are fields.
 */
export function NoteView({ note, editing, onChange, onDone }: Props) {
  const { t } = useTranslation();
  const title = useRef<HTMLInputElement>(null);
  const text = useRef<HTMLTextAreaElement>(null);

  // Writing starts in the title of a new note, in the text otherwise.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only when writing starts
  useEffect(() => {
    if (!editing) return;
    const field = note.title === "" ? title.current : text.current;
    field?.focus();
    if (field instanceof HTMLTextAreaElement) {
      field.setSelectionRange(field.value.length, field.value.length);
    }
  }, [editing]);

  const keys = (event: React.KeyboardEvent) => {
    // Excalidraw must not read these keys as its shortcuts.
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      onDone();
    }
  };

  return (
    <fieldset
      aria-label={note.title || t("canvases.notes.label")}
      inert={!editing}
      className="bz-canvas-note flex size-full flex-col overflow-hidden rounded-md px-3 pt-2 pb-3 shadow-md"
      // The rules start under the top margin: the lines of text sit on them.
      style={{ ...noteBackground(note), backgroundPosition: "0 8px", color: NOTE_INK }}
      onBlur={(event) => {
        // The focus left the note (not from the title to the text).
        if (editing && !event.currentTarget.contains(event.relatedTarget as Node | null)) onDone();
      }}
    >
      {editing ? (
        <>
          <input
            ref={title}
            aria-label={t("canvases.notes.title")}
            placeholder={t("canvases.notes.titlePlaceholder")}
            value={note.title}
            maxLength={200}
            onChange={(event) => onChange({ ...note, title: event.target.value })}
            onKeyDown={(event) => {
              keys(event);
              if (event.key === "Enter") {
                event.preventDefault();
                text.current?.focus();
              }
            }}
            className="bz-canvas-note-field w-full bg-transparent font-heading text-base font-bold leading-6 outline-none"
          />
          <textarea
            ref={text}
            aria-label={t("canvases.notes.text")}
            placeholder={t("canvases.notes.textPlaceholder")}
            value={note.text}
            maxLength={10_000}
            onChange={(event) => onChange({ ...note, text: event.target.value })}
            onKeyDown={keys}
            className="bz-canvas-note-field min-h-0 w-full flex-1 resize-none bg-transparent text-sm leading-6 outline-none"
          />
        </>
      ) : (
        <>
          <p
            className={`truncate font-heading text-base font-bold leading-6 ${note.title ? "" : "bz-canvas-note-placeholder"}`}
          >
            {note.title || t("canvases.notes.titlePlaceholder")}
          </p>
          <p
            className={`min-h-0 flex-1 overflow-hidden text-sm leading-6 break-words whitespace-pre-wrap ${note.text ? "" : "bz-canvas-note-placeholder"}`}
          >
            {note.text || t("canvases.notes.textPlaceholder")}
          </p>
        </>
      )}
    </fieldset>
  );
}
