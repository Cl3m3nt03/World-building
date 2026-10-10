import { useQuery } from "@tanstack/react-query";
import type { JSONContent } from "@tiptap/react";
import { AudioLines, Music2, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import { commands } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";
import { quillKeys } from "../hooks/useQuill";
import { useSoundNames } from "./CueMargin";
import { cueSpans } from "./cueMark";
import { useDeleteCue, useDraftCues } from "./useCues";

/** Characters of a passage shown in the list. */
const SNIPPET = 80;

/**
 * The sounds of the chapter shown (mode Audio), in the order of the text:
 * each with its kind, its file and the start of its passage; a click shows
 * it in the text. A sound whose passage was erased can be deleted here.
 */
export function CueList({ draftId, onOpen }: { draftId: string; onOpen: (cueId: string) => void }) {
  const { t } = useTranslation();
  const draft = useQuery({
    queryKey: quillKeys.draft(draftId),
    queryFn: () => unwrap(commands.getDraft(draftId)),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const cues = useDraftCues(draftId);
  const remove = useDeleteCue(draftId);
  const names = useSoundNames();
  let spans: ReturnType<typeof cueSpans> = [];
  try {
    spans = draft.data ? cueSpans(JSON.parse(draft.data.content) as JSONContent) : [];
  } catch {
    spans = [];
  }
  const all = cues.data ?? [];
  const placed = spans.flatMap((span) => {
    const cue = all.find((candidate) => candidate.id === span.cueId);
    return cue ? [{ cue, text: span.text }] : [];
  });
  const erased = all.filter((cue) => !spans.some((span) => span.cueId === cue.id));

  if (all.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">{t("quill.audio.empty")}</p>;
  }
  return (
    <div className="flex flex-col gap-2 p-4">
      <ul aria-label={t("quill.audio.list")} className="flex flex-col gap-1">
        {placed.map(({ cue, text }) => {
          const Icon = cue.kind === "ambience" ? AudioLines : Music2;
          const name = (cue.assetId && names.get(cue.assetId)) || t("quill.audio.missing");
          return (
            <li key={cue.id}>
              <button
                type="button"
                onClick={() => onOpen(cue.id)}
                className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
                <span className="flex min-w-0 flex-col">
                  <span className="text-xs text-muted-foreground">
                    {t("quill.audio.item", { kind: t(`quill.audio.kind.${cue.kind}`), name })}
                  </span>
                  <span className="line-clamp-2 text-sm">
                    {text.length > SNIPPET ? `${text.slice(0, SNIPPET)}…` : text}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        {erased.map((cue) => (
          <li key={cue.id} className="flex items-center gap-2 px-2 py-1.5">
            <span className="flex-1 text-sm text-muted-foreground">
              {t("quill.audio.erased", {
                name: (cue.assetId && names.get(cue.assetId)) || t("quill.audio.missing"),
              })}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("quill.audio.delete")}
              onClick={() => remove.mutate(cue.id)}
            >
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
      {(cues.error ?? remove.error) && <AppErrorMessage error={cues.error ?? remove.error} />}
    </div>
  );
}
