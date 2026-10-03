import { Plus, Trash2 } from "lucide-react";
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
import { commands, type RelationType } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";
import { cn } from "@/lib/utils";
import {
  useCreateRelationType,
  useDeleteRelationType,
  useUpdateRelationType,
} from "../hooks/useTrees";
import { relationIcon, relationName } from "../relations";
import { emptyRelationInput, RelationTypeForm, relationInput } from "./RelationTypeForm";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  relationTypes: RelationType[];
  /** Saves what the open tree has waiting (before a type it names goes). */
  flush: () => Promise<unknown> | undefined;
  /** A type went: the open tree's links that named it become « without type ». */
  onDeleted: (id: string) => void;
};

/** What is being edited: a new type, or one of the world. */
type Editing = { kind: "new" } | { kind: "type"; type: RelationType };

/**
 * The world's own relation types (docs/features/05-relation-tree.md),
 * shared by all its trees: their name, icon, category and inverse. The
 * provided ones are listed but cannot change. Deleting a type in use asks
 * first: its links become « without type ».
 */
export function RelationTypesDialog({
  open,
  onOpenChange,
  relationTypes,
  flush,
  onDeleted,
}: Props) {
  const { t } = useTranslation();
  const own = relationTypes.filter((type) => !type.builtin);
  const provided = relationTypes.filter((type) => type.builtin);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<{ type: RelationType; uses: number } | null>(null);
  const create = useCreateRelationType();
  const update = useUpdateRelationType();
  const remove = useDeleteRelationType(flush, onDeleted);
  const [usesError, setUsesError] = useState<unknown>(null);
  const error = create.error ?? update.error ?? remove.error ?? usesError;
  const current = editing?.kind === "type" ? editing.type : null;

  const askDelete = async (type: RelationType) => {
    try {
      setUsesError(null);
      const uses = await unwrap(commands.relationTypeUses(type.id));
      setDeleting({ type, uses });
    } catch (caught) {
      setUsesError(caught);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          onOpenChange(next);
          if (!next) setEditing(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("trees.relationTypes.title")}</DialogTitle>
            <DialogDescription>{t("trees.relationTypes.description")}</DialogDescription>
          </DialogHeader>
          {error ? <AppErrorMessage error={error} /> : null}
          <div className="grid gap-4 sm:grid-cols-[14rem_1fr]">
            <nav aria-label={t("trees.relationTypes.list")} className="flex flex-col gap-1">
              <Button
                variant="secondary"
                size="sm"
                className="justify-start"
                onClick={() => setEditing({ kind: "new" })}
              >
                <Plus />
                {t("trees.relationTypes.new")}
              </Button>
              <p className="mt-2 text-xs font-medium text-muted-foreground">
                {t("trees.relationTypes.own")}
              </p>
              {own.length === 0 && (
                <p className="text-xs text-muted-foreground">{t("trees.relationTypes.none")}</p>
              )}
              <ul className="flex flex-col gap-0.5">
                {own.map((type) => {
                  const Icon = relationIcon(type.icon);
                  return (
                    <li key={type.id}>
                      <button
                        type="button"
                        aria-current={current?.id === type.id}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50",
                          current?.id === type.id && "bg-secondary",
                        )}
                        onClick={() => setEditing({ kind: "type", type })}
                      >
                        <Icon aria-hidden className="size-4 shrink-0" />
                        <span className="truncate">{type.name}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-xs font-medium text-muted-foreground">
                {t("trees.relationTypes.provided")}
              </p>
              <ul className="flex flex-col gap-0.5 text-sm text-muted-foreground">
                {provided.map((type) => {
                  const Icon = relationIcon(type.icon);
                  return (
                    <li key={type.id} className="flex items-center gap-2 px-2 py-0.5">
                      <Icon aria-hidden className="size-4 shrink-0" />
                      {relationName(type, t)}
                    </li>
                  );
                })}
              </ul>
            </nav>
            <section aria-label={t("trees.relationTypes.form")}>
              {editing === null ? (
                <p className="text-sm text-muted-foreground">{t("trees.relationTypes.pick")}</p>
              ) : (
                <RelationTypeForm
                  // A fresh form for each type.
                  key={current?.id ?? "new"}
                  initial={current ? relationInput(current) : emptyRelationInput()}
                  relationTypes={relationTypes}
                  editingId={current?.id ?? null}
                  onSubmit={(input) =>
                    current
                      ? update.mutate(
                          { id: current.id, input },
                          { onSuccess: (type) => setEditing({ kind: "type", type }) },
                        )
                      : create.mutate(input, {
                          onSuccess: (type) => setEditing({ kind: "type", type }),
                        })
                  }
                >
                  {(valid) => (
                    <div className="flex justify-between gap-2">
                      {current ? (
                        <Button
                          type="button"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => void askDelete(current)}
                        >
                          <Trash2 />
                          {t("trees.relationTypes.delete")}
                        </Button>
                      ) : (
                        <span />
                      )}
                      <Button
                        type="submit"
                        disabled={!valid || create.isPending || update.isPending}
                      >
                        {current ? t("trees.relationTypes.save") : t("trees.relationTypes.create")}
                      </Button>
                    </div>
                  )}
                </RelationTypeForm>
              )}
            </section>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={deleting !== null} onOpenChange={(next) => !next && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("trees.relationTypes.deleteTitle", { name: deleting?.type.name ?? "" })}
            </DialogTitle>
            <DialogDescription>
              {deleting && deleting.uses > 0
                ? t("trees.relationTypes.deleteUsed", { count: deleting.uses })
                : t("trees.relationTypes.deleteUnused")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              {t("trees.variants.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => {
                if (!deleting) return;
                remove.mutate(deleting.type.id, {
                  onSuccess: () => {
                    setDeleting(null);
                    setEditing(null);
                  },
                });
              }}
            >
              {t("trees.relationTypes.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
