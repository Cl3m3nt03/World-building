import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import type { JSONContent } from "@tiptap/react";
import { ArrowLeft, Star } from "lucide-react";
import { useId, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type Chapter, commands } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";
import { cn } from "@/lib/utils";
import { quillKeys } from "../hooks/useQuill";
import { compareDrafts, type Piece, paragraphs } from "./diff";
import { draftRoute } from "./routes";

function useDraft(id: string) {
  return useQuery({
    queryKey: quillKeys.draft(id),
    queryFn: () => unwrap(commands.getDraft(id)),
  });
}

/**
 * Two drafts of a chapter side by side: equal paragraphs face each other,
 * changed words are marked (removed on the left, added on the right).
 */
export function CompareView({
  chapter,
  leftId,
  rightId,
  onPick,
}: {
  chapter: Chapter;
  leftId: string;
  rightId: string;
  /** Out of the routes (the world panel's Drafts tab): the drafts picked, no way back. */
  onPick?: (leftId: string, rightId: string) => void;
}) {
  const { t } = useTranslation();
  const { worldId } = useParams({ from: "/world/$worldId" });
  const navigate = useNavigate();
  const left = useDraft(leftId);
  const right = useDraft(rightId);
  const rows = useMemo(() => {
    if (!left.data || !right.data) return [];
    return compareDrafts(
      paragraphs(JSON.parse(left.data.content) as JSONContent),
      paragraphs(JSON.parse(right.data.content) as JSONContent),
    );
  }, [left.data, right.data]);
  const changed = rows.some((row) =>
    [...(row.left ?? []), ...(row.right ?? [])].some((piece) => piece.kind !== "same"),
  );
  const go = (nextLeft: string, nextRight: string) =>
    onPick
      ? onPick(nextLeft, nextRight)
      : void navigate({
          to: "/world/$worldId/quill/story/$storyId/chapter/$chapterId/compare/$leftId/$rightId",
          params: {
            worldId,
            storyId: chapter.storyId,
            chapterId: chapter.id,
            leftId: nextLeft,
            rightId: nextRight,
          },
        });
  const error = left.error ?? right.error;

  return (
    <section
      aria-label={t("quill.compare.label", { name: chapter.title })}
      className="flex min-h-0 flex-col gap-3"
    >
      <div className="flex items-center gap-2">
        {!onPick && (
          <Button asChild variant="ghost" size="sm">
            <Link {...draftRoute(worldId, chapter, rightId)}>
              <ArrowLeft />
              {t("quill.compare.back")}
            </Link>
          </Button>
        )}
        <h2 className="font-heading text-lg font-bold">
          {t("quill.compare.title", { name: chapter.title })}
        </h2>
        <p className="ml-auto text-xs text-muted-foreground">
          <del className="rounded-sm bg-destructive/15 px-1">{t("quill.compare.removed")}</del>{" "}
          <ins className="rounded-sm bg-primary/20 px-1 no-underline">
            {t("quill.compare.added")}
          </ins>
        </p>
      </div>
      {error && <AppErrorMessage error={error} />}
      <div className="grid grid-cols-2 gap-4">
        <DraftPicker
          chapter={chapter}
          value={leftId}
          label={t("quill.compare.left")}
          onChange={(id) => go(id, rightId)}
        />
        <DraftPicker
          chapter={chapter}
          value={rightId}
          label={t("quill.compare.right")}
          onChange={(id) => go(leftId, id)}
        />
      </div>
      {left.data && right.data && !changed && (
        <p role="status" className="text-sm text-muted-foreground">
          {t("quill.compare.same")}
        </p>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <table className="w-full table-fixed border-separate border-spacing-x-4 border-spacing-y-2 text-sm leading-relaxed">
          <caption className="sr-only">{t("quill.compare.title", { name: chapter.title })}</caption>
          <thead className="sr-only">
            <tr>
              <th scope="col">{t("quill.compare.left")}</th>
              <th scope="col">{t("quill.compare.right")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a comparison is drawn once, never reordered.
              <tr key={index} className="align-top">
                <td>{row.left && <Pieces pieces={row.left} />}</td>
                <td>{row.right && <Pieces pieces={row.right} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Pieces({ pieces }: { pieces: Piece[] }) {
  const { t } = useTranslation();
  return pieces.map((piece, index) => {
    const key = `${index}-${piece.kind}`;
    if (piece.kind === "removed") {
      return (
        <del key={key} className="rounded-sm bg-destructive/15">
          <span className="sr-only">{t("quill.compare.removedSr")}</span>
          {piece.text}
        </del>
      );
    }
    if (piece.kind === "added") {
      return (
        <ins key={key} className="rounded-sm bg-primary/20 no-underline">
          <span className="sr-only">{t("quill.compare.addedSr")}</span>
          {piece.text}
        </ins>
      );
    }
    return <span key={key}>{piece.text}</span>;
  });
}

function DraftPicker({
  chapter,
  value,
  label,
  onChange,
}: {
  chapter: Chapter;
  value: string;
  label: string;
  onChange: (id: string) => void;
}) {
  const id = useId();
  const { t } = useTranslation();
  const draft = chapter.drafts.find((candidate) => candidate.id === value);
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} size="sm" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {chapter.drafts.map((candidate) => (
            <SelectItem key={candidate.id} value={candidate.id}>
              {candidate.id === chapter.currentDraftId && (
                <Star aria-hidden className="fill-primary text-primary" />
              )}
              {candidate.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {draft && (
        <span className={cn("text-xs text-muted-foreground")}>
          {t("quill.words", { count: draft.wordCount })}
        </span>
      )}
    </div>
  );
}
