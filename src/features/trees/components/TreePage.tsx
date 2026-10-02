import { useNavigate, useParams } from "@tanstack/react-router";
import { Maximize, UserRoundPlus } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { DocumentTitleField } from "@/components/DocumentTitleField";
import { Button } from "@/components/ui/button";
import { useCardTypes } from "@/features/card-types";
import { useCardList } from "@/features/cards";
import { useMarkOpened } from "@/features/cards/hooks/useCards";
import type { Card, CardType, RelationTree } from "@/lib/bindings";
import { documentRoute } from "@/lib/documentRoute";
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
  const { worldId, treeId } = useParams({ from: "/world/$worldId/world/tree/$treeId" });
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
  return (
    <TreeEditor
      key={tree.data.id}
      worldId={worldId}
      tree={tree.data}
      cards={cards.data}
      types={types.data}
    />
  );
}

function TreeEditor({
  worldId,
  tree,
  cards,
  types,
}: {
  worldId: string;
  tree: RelationTree;
  cards: Card[];
  types: CardType[];
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
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
            onChange={(change) => editor.update(variantId, change)}
            onOpenCard={(cardId) => void navigate(documentRoute(worldId, "card", cardId))}
          />
        )}
        {/* The tools float at the bottom of the view, as on the board (docs/contexte.md). */}
        <div
          role="toolbar"
          aria-label={t("trees.toolbar")}
          className="glass absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-lg p-1 shadow-sm"
        >
          <Button variant="ghost" size="sm" onClick={() => view.current?.addNode()}>
            <UserRoundPlus />
            {t("trees.nodes.add")}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => view.current?.recenter()}>
            <Maximize />
            {t("trees.recenter")}
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t("trees.navigationHint")}</p>
    </article>
  );
}
