import { useEffect, useId, useRef, useState } from "react";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Input } from "@/components/ui/input";
import { usePendingSave } from "@/lib/pendingSaves";

/** Typing pauses this long before the name is saved. */
const SAVE_DELAY_MS = 500;

/** What renames the document (a TanStack mutation). */
export type RenameMutation = {
  mutateAsync: (title: string) => Promise<unknown>;
  isError: boolean;
  error: unknown;
};

/**
 * The name of a map or a graph, at the top left of its page: saved as it is
 * typed (after a pause), on Enter and when the field is left. An empty name
 * is not saved.
 */
export function DocumentTitleField({
  title: saved,
  label,
  rename,
}: {
  title: string;
  /** Accessible name of the field ("Nom de la map"…). */
  label: string;
  rename: RenameMutation;
}) {
  const [title, setTitle] = useState(saved);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const id = useId();

  // While the field is being edited, the title saved a moment ago coming
  // back from the Rust side must not replace what has been typed since.
  const editing = useRef(false);
  useEffect(() => {
    if (!editing.current) setTitle(saved);
  }, [saved]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const save = (value: string) => {
    clearTimeout(timer.current);
    const trimmed = value.trim();
    if (trimmed === "" || trimmed === saved) return undefined;
    // A failure is shown under the title (`rename.error`).
    return rename.mutateAsync(trimmed).catch(() => {});
  };
  usePendingSave(() => save(title));

  return (
    <div className="flex min-w-48 flex-1 flex-col gap-1">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Input
        id={id}
        value={title}
        maxLength={200}
        aria-invalid={title.trim() === ""}
        onChange={(event) => {
          const value = event.target.value;
          setTitle(value);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => save(value), SAVE_DELAY_MS);
        }}
        onFocus={() => {
          editing.current = true;
        }}
        onBlur={() => {
          editing.current = false;
          void save(title);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") void save(title);
        }}
        className="h-auto border-transparent bg-transparent px-1 py-0.5 font-heading text-xl font-bold shadow-none hover:border-border focus-visible:border-ring md:text-xl dark:bg-transparent"
      />
      {rename.isError && <AppErrorMessage error={rename.error} />}
    </div>
  );
}
