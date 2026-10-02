import { useParams } from "@tanstack/react-router";
import { Maximize } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { DocumentTitleField } from "@/components/DocumentTitleField";
import { Button } from "@/components/ui/button";
import { useCardTypes } from "@/features/card-types";
import { useCardList } from "@/features/cards";
import { useMarkOpened } from "@/features/cards/hooks/useCards";
import type { Card, CardType, RelationTree } from "@/lib/bindings";
import { useTreeEditor } from "../hooks/useTreeEditor";
import { useRenameTree, useTree } from "../hooks/useTrees";
import { TreeCanvas, type TreeCanvasHandle } from "./TreeCanvas";

function TitleField({ tree }: { tree: RelationTree }) {
  const { t } = useTranslation();
  const rename = useRenameTree(tree.id);
  return <DocumentTitleField title={tree.title} label={t("trees.title")} rename={rename} />;
}

/** A relation tree, opened in the World tab (M6). */
export function TreePage() {
  const { treeId } = useParams({ from: "/world/$worldId/world/tree/$treeId" });
  const tree = useTree(treeId);
  const cards = useCardList(false);
  const types = useCardTypes();
  useMarkOpened(treeId);

  const error = tree.error ?? cards.error ?? types.error;
  if (error) {
    return (
      <div className="p-6">
        <AppErrorMessage error={error} />
      </div>
    );
  }
  if (!tree.data || !cards.data || !types.data) return null;
  // Remounted for another tree: the editor starts from that tree's variants.
  return <TreeEditor key={tree.data.id} tree={tree.data} cards={cards.data} types={types.data} />;
}

function TreeEditor({
  tree,
  cards,
  types,
}: {
  tree: RelationTree;
  cards: Card[];
  types: CardType[];
}) {
  const { t } = useTranslation();
  const view = useRef<TreeCanvasHandle>(null);
  const editor = useTreeEditor(tree);
  const [variantId] = useState(() => tree.variants[0]?.id ?? "");
  const content = editor.contents[variantId];
  const cardsById = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);
  const typesById = useMemo(() => new Map(types.map((type) => [type.id, type])), [types]);

  return (
    <article aria-label={tree.title} className="glass flex h-full flex-col gap-3 rounded-lg p-3">
      <header className="flex flex-wrap items-center gap-2">
        <TitleField tree={tree} />
        <Button variant="secondary" size="sm" onClick={() => view.current?.recenter()}>
          <Maximize />
          {t("trees.recenter")}
        </Button>
      </header>
      {editor.error ? <AppErrorMessage error={editor.error} /> : null}
      <div className="relative min-h-0 flex-1">
        {content && (
          <TreeCanvas
            ref={view}
            content={content}
            cardsById={cardsById}
            typesById={typesById}
            label={t("trees.viewLabel", { name: tree.title })}
            onMoveNodes={(positions) =>
              editor.update(variantId, (previous) => ({
                ...previous,
                nodes: previous.nodes.map((node) => {
                  const moved = positions.get(node.id);
                  return moved ? { ...node, x: moved.x, y: moved.y } : node;
                }),
              }))
            }
          />
        )}
      </div>
      <p className="text-xs text-muted-foreground">{t("trees.navigationHint")}</p>
    </article>
  );
}
