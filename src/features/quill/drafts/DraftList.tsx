import { Link, useNavigate, useParams } from "@tanstack/react-router";
import {
  Columns2,
  Copy,
  FilePlus2,
  MoreHorizontal,
  Pencil,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { type Chapter, commands, type DraftInfo } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";
import { useChapterChange } from "../hooks/useQuill";
import { draftRoute } from "./routes";

type Props = {
  chapter: Chapter;
  /** The draft shown in the editor. */
  openId: string;
};

/**
 * Under the open chapter, its drafts: the current one marked, each opened,
 * made current, renamed, duplicated or deleted; a new one, empty or a copy
 * of the current one; and « Comparer ».
 */
export function DraftList({ chapter, openId }: Props) {
  const { t } = useTranslation();
  const { worldId } = useParams({ from: "/world/$worldId" });
  const navigate = useNavigate();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<DraftInfo | null>(null);
  const open = (draftId: string) => void navigate(draftRoute(worldId, chapter, draftId));
  const create = useChapterChange(({ copyOf }: { copyOf: string | null }) =>
    unwrap(
      commands.createDraft(
        chapter.id,
        t("quill.defaultDraft", { number: chapter.drafts.length + 1 }),
        copyOf,
      ),
    ),
  );
  const created = (result: unknown) => {
    const drafts = (result as Chapter).drafts;
    const last = drafts.at(-1);
    if (last) open(last.id);
  };
  const others = chapter.drafts.filter((draft) => draft.id !== chapter.currentDraftId);

  return (
    <div className="ml-3 flex flex-col gap-0.5 border-l border-border pl-2">
      <ul
        aria-label={t("quill.drafts.label", { name: chapter.title })}
        className="flex flex-col gap-0.5"
      >
        {chapter.drafts.map((draft) => (
          <DraftRow
            key={draft.id}
            chapter={chapter}
            draft={draft}
            open={draft.id === openId}
            renaming={renaming === draft.id}
            onRename={() => setRenaming(draft.id)}
            onRenamed={() => setRenaming(null)}
            onDuplicated={created}
            onDelete={() => setDeleting(draft)}
          />
        ))}
      </ul>
      {create.error && <AppErrorMessage error={create.error} />}
      <div className="flex flex-wrap gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="xs" disabled={create.isPending}>
              <Plus />
              {t("quill.drafts.new")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem
              onSelect={() => create.mutate({ copyOf: null }, { onSuccess: created })}
            >
              <FilePlus2 />
              {t("quill.drafts.newEmpty")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                create.mutate({ copyOf: chapter.currentDraftId }, { onSuccess: created })
              }
            >
              <Copy />
              {t("quill.drafts.newCopy")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {others[0] && (
          <Button asChild variant="ghost" size="xs">
            <Link
              to="/world/$worldId/quill/story/$storyId/chapter/$chapterId/compare/$leftId/$rightId"
              params={{
                worldId,
                storyId: chapter.storyId,
                chapterId: chapter.id,
                leftId: chapter.currentDraftId,
                rightId: openId === chapter.currentDraftId ? others[0].id : openId,
              }}
            >
              <Columns2 />
              {t("quill.drafts.compare")}
            </Link>
          </Button>
        )}
      </div>
      <DeleteDraftDialog
        draft={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={(after) => {
          // The draft shown is gone: the chapter's current one opens.
          if (deleting?.id === openId) open(after.currentDraftId);
          setDeleting(null);
        }}
      />
    </div>
  );
}

/** Deleting a draft is for good: it is asked first. */
function DeleteDraftDialog({
  draft,
  onClose,
  onDeleted,
}: {
  draft: DraftInfo | null;
  onClose: () => void;
  onDeleted: (chapter: Chapter) => void;
}) {
  const { t } = useTranslation();
  const remove = useChapterChange((id: string) => unwrap(commands.deleteDraft(id)));
  return (
    <Dialog
      open={draft !== null}
      onOpenChange={(next) => {
        if (!next) {
          remove.reset();
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("quill.drafts.deleteTitle", { name: draft?.name ?? "" })}</DialogTitle>
          <DialogDescription>
            {t("quill.drafts.deleteDescription", { count: draft?.wordCount ?? 0 })}
          </DialogDescription>
        </DialogHeader>
        {remove.error && <AppErrorMessage error={remove.error} />}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("quill.cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={remove.isPending}
            onClick={() =>
              draft &&
              remove.mutate(draft.id, { onSuccess: (after) => onDeleted(after as Chapter) })
            }
          >
            <Trash2 />
            {t("quill.deleteConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DraftRow({
  chapter,
  draft,
  open,
  renaming,
  onRename,
  onRenamed,
  onDuplicated,
  onDelete,
}: {
  chapter: Chapter;
  draft: DraftInfo;
  open: boolean;
  renaming: boolean;
  onRename: () => void;
  onRenamed: () => void;
  onDuplicated: (result: unknown) => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const { worldId } = useParams({ from: "/world/$worldId" });
  const current = draft.id === chapter.currentDraftId;
  const rename = useChapterChange((name: string) => unwrap(commands.renameDraft(draft.id, name)));
  const makeCurrent = useChapterChange(() => unwrap(commands.setCurrentDraft(draft.id)));
  const duplicate = useChapterChange(() =>
    unwrap(
      commands.createDraft(chapter.id, t("quill.drafts.copyName", { name: draft.name }), draft.id),
    ),
  );
  const error = rename.error ?? makeCurrent.error ?? duplicate.error;

  return (
    <li className="group flex flex-col">
      <div className="flex items-center gap-1">
        {renaming ? (
          <Input
            aria-label={t("quill.drafts.name")}
            defaultValue={draft.name}
            maxLength={200}
            autoFocus
            onFocus={(event) => event.currentTarget.select()}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") {
                event.currentTarget.value = draft.name;
                event.currentTarget.blur();
              }
            }}
            onBlur={(event) => {
              const name = event.currentTarget.value.trim();
              if (name && name !== draft.name) rename.mutate(name);
              onRenamed();
            }}
            className="h-7 text-xs"
          />
        ) : (
          <Link
            {...draftRoute(worldId, chapter, draft.id)}
            aria-label={t(current ? "quill.drafts.linkCurrent" : "quill.drafts.link", {
              name: draft.name,
              count: draft.wordCount,
            })}
            aria-current={open ? "true" : undefined}
            onDoubleClick={onRename}
            className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 py-1 text-xs outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=true]:bg-accent aria-[current=true]:font-medium"
          >
            {current && <Star aria-hidden className="size-3 shrink-0 fill-primary text-primary" />}
            <span className="truncate">{draft.name}</span>
            <span className="ml-auto shrink-0 text-muted-foreground">{draft.wordCount}</span>
          </Link>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={t("quill.drafts.actions", { name: draft.name })}
              className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={current} onSelect={() => makeCurrent.mutate(undefined)}>
              <Star />
              {t("quill.drafts.makeCurrent")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onRename}>
              <Pencil />
              {t("quill.drafts.rename")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => duplicate.mutate(undefined, { onSuccess: onDuplicated })}
            >
              <Copy />
              {t("quill.drafts.duplicate")}
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              disabled={chapter.drafts.length <= 1}
              onSelect={onDelete}
            >
              <Trash2 />
              {t("quill.drafts.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {error && <AppErrorMessage error={error} />}
    </li>
  );
}
