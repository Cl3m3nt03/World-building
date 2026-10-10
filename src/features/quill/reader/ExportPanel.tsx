import { useMutation } from "@tanstack/react-query";
import { BookDown, Star } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { commands, type ExportFormat, type StoryOutline } from "@/lib/bindings";
import { saveDialog } from "@/lib/dialogs";
import { unwrap } from "@/lib/ipc";
import { coverPng } from "../cover/coverPng";

/** The formats offered, with their file extension. */
const FORMATS: { format: ExportFormat; extension: string }[] = [
  { format: "epub", extension: "epub" },
  { format: "pdf", extension: "pdf" },
  { format: "docx", extension: "docx" },
];

/** A file name from a title (characters Windows refuses taken out). */
export function fileName(title: string): string {
  const name = title.replace(/[<>:"/\\|?*]/g, "").trim();
  return name || "story";
}

/**
 * The Export tab of the publishing panel (docs/features/08-quill.md, M10):
 * the format, the chapters (all at first) and the draft of each (the current
 * one at first), then a file to write the book to.
 */
export function ExportPanel({ outline }: { outline: StoryOutline }) {
  const { t, i18n } = useTranslation();
  const formatId = useId();
  const [format, setFormat] = useState<ExportFormat>("epub");
  const [chosen, setChosen] = useState<Record<string, string | null>>({});
  // The chapters keep their choice; a new chapter comes with its current draft.
  useEffect(() => {
    setChosen((current) =>
      Object.fromEntries(
        outline.chapters.map((chapter) => {
          if (!(chapter.id in current)) return [chapter.id, chapter.currentDraftId];
          const draftId = current[chapter.id];
          if (draftId === null || draftId === undefined) return [chapter.id, null];
          // A draft deleted meanwhile: the current one.
          const kept = chapter.drafts.some((draft) => draft.id === draftId);
          return [chapter.id, kept ? draftId : chapter.currentDraftId];
        }),
      ),
    );
  }, [outline.chapters]);

  const picked = outline.chapters.filter((chapter) => chosen[chapter.id]);
  const run = useMutation({
    mutationFn: async () => {
      const extension = FORMATS.find((item) => item.format === format)?.extension ?? format;
      const path = await saveDialog({
        title: t("quill.export.saveTitle"),
        defaultPath: `${fileName(outline.story.title)}.${extension}`,
        filters: [{ name: t(`quill.export.formats.${format}`), extensions: [extension] }],
      });
      if (!path) return null;
      const cover = await coverPng(outline.story);
      return unwrap(
        commands.exportStory({
          storyId: outline.story.id,
          chapters: picked.map((chapter) => ({
            chapterId: chapter.id,
            draftId: chosen[chapter.id] ?? chapter.currentDraftId,
          })),
          format,
          path,
          language: i18n.language,
          coverPng: cover,
        }),
      );
    },
  });

  const all = picked.length === outline.chapters.length;
  return (
    <div className="flex flex-col gap-5 p-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium">{t("quill.export.format")}</legend>
        <RadioGroup
          value={format}
          onValueChange={(value) => setFormat(value as ExportFormat)}
          className="flex flex-col gap-2"
        >
          {FORMATS.map(({ format: item }) => (
            <div key={item} className="flex items-start gap-2">
              <RadioGroupItem value={item} id={`${formatId}-${item}`} className="mt-0.5" />
              <Label htmlFor={`${formatId}-${item}`} className="flex flex-col items-start gap-0.5">
                <span>{t(`quill.export.formats.${item}`)}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {t(`quill.export.formatHints.${item}`)}
                </span>
              </Label>
            </div>
          ))}
        </RadioGroup>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <legend className="text-sm font-medium">{t("quill.export.chapters")}</legend>
          <Button
            variant="ghost"
            size="xs"
            onClick={() =>
              setChosen(
                Object.fromEntries(
                  outline.chapters.map((chapter) => [
                    chapter.id,
                    all ? null : (chosen[chapter.id] ?? chapter.currentDraftId),
                  ]),
                ),
              )
            }
          >
            {t(all ? "quill.export.none" : "quill.export.all")}
          </Button>
        </div>
        <ul className="flex flex-col gap-2">
          {outline.chapters.map((chapter) => {
            const draftId = chosen[chapter.id] ?? null;
            const checkId = `${formatId}-${chapter.id}`;
            return (
              <li
                key={chapter.id}
                className="flex flex-col gap-1 rounded-md border border-border p-2"
              >
                <div className="flex items-center gap-2">
                  <input
                    id={checkId}
                    type="checkbox"
                    checked={draftId !== null}
                    onChange={(event) =>
                      setChosen((current) => ({
                        ...current,
                        [chapter.id]: event.target.checked ? chapter.currentDraftId : null,
                      }))
                    }
                    className="size-4 accent-primary"
                  />
                  <label htmlFor={checkId} className="flex-1 truncate text-sm">
                    {chapter.title}
                  </label>
                </div>
                {draftId !== null && chapter.drafts.length > 1 && (
                  <Select
                    value={draftId}
                    onValueChange={(value) =>
                      setChosen((current) => ({ ...current, [chapter.id]: value }))
                    }
                  >
                    <SelectTrigger
                      size="sm"
                      aria-label={t("quill.export.draftOf", { chapter: chapter.title })}
                      className="ml-6 w-auto"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {chapter.drafts.map((draft) => (
                        <SelectItem key={draft.id} value={draft.id}>
                          {draft.id === chapter.currentDraftId && (
                            <Star aria-hidden className="size-3.5 fill-current text-primary" />
                          )}
                          {draft.id === chapter.currentDraftId
                            ? t("quill.export.currentDraft", { name: draft.name })
                            : draft.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </li>
            );
          })}
        </ul>
      </fieldset>
      <Button disabled={picked.length === 0 || run.isPending} onClick={() => run.mutate()}>
        <BookDown />
        {t(run.isPending ? "quill.export.running" : "quill.export.run")}
      </Button>
      {run.data && (
        <p role="status" className="text-sm break-all">
          {t("quill.export.done", { path: run.data })}
        </p>
      )}
      {run.error ? <AppErrorMessage error={run.error} /> : null}
    </div>
  );
}
