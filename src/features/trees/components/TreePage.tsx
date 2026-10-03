import { useNavigate, useParams } from "@tanstack/react-router";
import { Layers, Redo2, Undo2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { DocumentTitleField } from "@/components/DocumentTitleField";
import { Button } from "@/components/ui/button";
import { useCardTypes } from "@/features/card-types";
import { useCardList } from "@/features/cards";
import { useMarkOpened } from "@/features/cards/hooks/useCards";
import type { Card, CardType, RelationTree, RelationType } from "@/lib/bindings";
import { documentRoute } from "@/lib/documentRoute";
import { useTreeEditor } from "../hooks/useTreeEditor";
import { useRelationTypes, useRenameTree, useTree } from "../hooks/useTrees";
import { useVariants } from "../hooks/useVariants";
import { RelationTypesDialog } from "./RelationTypesDialog";
import { TreeCanvas, type TreeCanvasHandle } from "./TreeCanvas";
import { VariantTabs } from "./VariantTabs";

function TitleField({ tree }: { tree: RelationTree }) {
  const { t } = useTranslation();
  const rename = useRenameTree(tree.id);
  return <DocumentTitleField title={tree.title} label={t("trees.title")} rename={rename} />;
}

/** A relation tree, opened in the World tab (M6). */
export function TreePage() {
  const { worldId, treeId } = useParams({ from: "/world/$worldId/world/tree/$treeId" });
  const tree = useTree(treeId);
  const cards = useCardList(false);
  const types = useCardTypes();
  const relationTypes = useRelationTypes();
  useMarkOpened(treeId);

  const error = tree.error ?? cards.error ?? types.error ?? relationTypes.error;
  if (error) {
    return (
      <div className="p-6">
        <AppErrorMessage error={error} />
      </div>
    );
  }
  if (!tree.data || !cards.data || !types.data || !relationTypes.data) return null;
  // Remounted for another tree: the editor starts from that tree's variants.
  return (
    <TreeEditor
      key={tree.data.id}
      worldId={worldId}
      tree={tree.data}
      cards={cards.data}
      types={types.data}
      relationTypes={relationTypes.data}
    />
  );
}

function TreeEditor({
  worldId,
  tree,
  cards,
  types,
  relationTypes,
}: {
  worldId: string;
  tree: RelationTree;
  cards: Card[];
  types: CardType[];
  relationTypes: RelationType[];
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const view = useRef<TreeCanvasHandle>(null);
  const editor = useTreeEditor(tree);
  const variants = useVariants(tree.id, editor);
  const [chosen, setChosen] = useState(() => tree.variants[0]?.id ?? "");
  // A deleted variant: the first one shows.
  const variantId = tree.variants.some((v) => v.id === chosen)
    ? chosen
    : (tree.variants[0]?.id ?? "");
  const variant = tree.variants.find((v) => v.id === variantId);
  const [addingVariant, setAddingVariant] = useState(false);
  const [managingRelations, setManagingRelations] = useState(false);

  // Ctrl+Z / Ctrl+Y (or Ctrl+Shift+Z) for the variant shown; fields keep their own.
  const historyKeys = useRef({
    undo: () => editor.undo(variantId),
    redo: () => editor.redo(variantId),
  });
  historyKeys.current = { undo: () => editor.undo(variantId), redo: () => editor.redo(variantId) };
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        historyKeys.current.undo();
      } else if (key === "y" || (key === "z" && event.shiftKey)) {
        event.preventDefault();
        historyKeys.current.redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const content = editor.contents[variantId];
  const addVariant = (name: string) =>
    variants.add.mutate(
      { copyOf: variantId, name },
      {
        onSuccess: (next) => {
          // The copy comes right after the variant it copies.
          const index = next.variants.findIndex((v) => v.id === variantId);
          const copy = next.variants[index + 1];
          if (copy) setChosen(copy.id);
        },
      },
    );
  const cardsById = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);
  const typesById = useMemo(() => new Map(types.map((type) => [type.id, type])), [types]);

  return (
    <article aria-label={tree.title} className="glass flex h-full flex-col gap-3 rounded-lg p-3">
      <header className="flex flex-wrap items-center gap-2">
        <TitleField tree={tree} />
      </header>
      {(editor.error ?? variants.error) ? (
        <AppErrorMessage error={editor.error ?? variants.error} />
      ) : null}
      <div className="relative min-h-0 flex-1">
        {content && (
          <TreeCanvas
            ref={view}
            content={content}
            cardsById={cardsById}
            typesById={typesById}
            relationTypes={relationTypes}
            label={
              tree.variants.length > 1
                ? t("trees.viewLabelVariant", { name: tree.title, variant: variant?.name ?? "" })
                : t("trees.viewLabel", { name: tree.title })
            }
            variantId={variantId}
            onManageRelations={() => setManagingRelations(true)}
            tools={
              <>
                <span aria-hidden className="mx-1 h-5 w-px bg-border" />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("trees.history.undo")}
                  title={t("trees.history.undo")}
                  disabled={!editor.canUndo(variantId)}
                  onClick={() => editor.undo(variantId)}
                >
                  <Undo2 />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("trees.history.redo")}
                  title={t("trees.history.redo")}
                  disabled={!editor.canRedo(variantId)}
                  onClick={() => editor.redo(variantId)}
                >
                  <Redo2 />
                </Button>
                <span aria-hidden className="mx-1 h-5 w-px bg-border" />
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t("trees.variants.addButton")}
                  title={t("trees.variants.addButton")}
                  disabled={variants.add.isPending}
                  onClick={() => setAddingVariant(true)}
                >
                  <Layers />
                  <span className="max-xl:sr-only">{t("trees.variants.addButton")}</span>
                </Button>
              </>
            }
            aboveTools={
              tree.variants.length > 1 || addingVariant ? (
                <VariantTabs
                  variants={tree.variants}
                  current={variantId}
                  onSelect={setChosen}
                  adding={addingVariant}
                  onAddingChange={setAddingVariant}
                  onAdd={addVariant}
                  onRename={(id, name) => variants.rename.mutate({ id, name })}
                  onDuplicate={(id) => {
                    const source = tree.variants.find((v) => v.id === id);
                    if (!source) return;
                    variants.add.mutate(
                      { copyOf: id, name: t("trees.variants.copyName", { name: source.name }) },
                      {
                        onSuccess: (next) => {
                          const index = next.variants.findIndex((v) => v.id === id);
                          const copy = next.variants[index + 1];
                          if (copy) setChosen(copy.id);
                        },
                      },
                    );
                  }}
                  onMove={(id, index) => variants.move.mutate({ id, index })}
                  onDelete={(id) => variants.remove.mutate(id)}
                />
              ) : null
            }
            onChange={(change, group) => editor.update(variantId, change, group ?? null)}
            onOpenCard={(cardId) => void navigate(documentRoute(worldId, "card", cardId))}
          />
        )}
      </div>
      <p className="text-xs text-muted-foreground">{t("trees.navigationHint")}</p>
      <RelationTypesDialog
        open={managingRelations}
        onOpenChange={setManagingRelations}
        relationTypes={relationTypes}
        flush={editor.flush}
        onDeleted={(id) =>
          // The Rust side already cleared it in every tree: the open one
          // follows, its undo history too (no step may name it again).
          editor.rewriteAll((previous) =>
            previous.edges.some((edge) => edge.relationTypeId === id)
              ? {
                  ...previous,
                  edges: previous.edges.map((edge) =>
                    edge.relationTypeId === id ? { ...edge, relationTypeId: null } : edge,
                  ),
                }
              : previous,
          )
        }
      />
    </article>
  );
}
