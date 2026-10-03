import { useNavigate, useParams } from "@tanstack/react-router";
import { Layers } from "lucide-react";
import { useMemo, useRef, useState } from "react";
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
            tools={
              <Button
                variant="ghost"
                size="sm"
                disabled={variants.add.isPending}
                onClick={() => setAddingVariant(true)}
              >
                <Layers />
                {t("trees.variants.addButton")}
              </Button>
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
            onChange={(change) => editor.update(variantId, change)}
            onOpenCard={(cardId) => void navigate(documentRoute(worldId, "card", cardId))}
          />
        )}
      </div>
      <p className="text-xs text-muted-foreground">{t("trees.navigationHint")}</p>
    </article>
  );
}
