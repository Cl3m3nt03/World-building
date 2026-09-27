import { Link, useParams } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { typeColor, typeIcon, useCardTypes } from "@/features/card-types";
import { useCardList } from "../hooks/useCards";
import { CreateCardContextMenu, CreateCardMenu } from "./CreateCardMenu";
import { TrashDialog } from "./TrashDialog";

/**
 * Sidebar of the World tab (simple list for M2; folders, sorting and search
 * come with M3): the world's cards, a right click anywhere to create one, and
 * "New card" / "Trash" at the bottom.
 */
export function CardsSidebar() {
  const { t } = useTranslation();
  const { worldId } = useParams({ from: "/world/$worldId" });
  const cards = useCardList(false);
  const types = useCardTypes();
  const [trashOpen, setTrashOpen] = useState(false);

  return (
    <aside aria-label={t("sidebar.label")} className="glass flex h-full flex-col rounded-lg">
      <CreateCardContextMenu>
        <div className="flex min-h-0 flex-1 flex-col">
          <ScrollArea className="min-h-0 flex-1">
            {cards.error && (
              <div className="p-2">
                <AppErrorMessage error={cards.error} />
              </div>
            )}
            {cards.data?.length === 0 ? (
              <p className="p-4 text-center text-xs text-muted-foreground">{t("sidebar.empty")}</p>
            ) : (
              <ul aria-label={t("sidebar.cards")} className="flex flex-col gap-0.5 p-2">
                {cards.data?.map((card) => {
                  const type = types.data?.find((candidate) => candidate.id === card.typeId);
                  const Icon = typeIcon(type?.icon ?? "shapes");
                  return (
                    <li key={card.id}>
                      <Link
                        to="/world/$worldId/world/card/$cardId"
                        params={{ worldId, cardId: card.id }}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:bg-secondary aria-[current=page]:text-foreground"
                      >
                        <Icon
                          aria-hidden
                          className="size-4 shrink-0"
                          style={{ color: typeColor(type?.color ?? "slate") }}
                        />
                        <span className="truncate">{card.title}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </ScrollArea>
        </div>
      </CreateCardContextMenu>
      <div className="flex gap-1 border-t border-border p-2">
        <CreateCardMenu align="start">
          <Button variant="secondary" size="sm" className="flex-1">
            <Plus />
            {t("sidebar.newCard")}
          </Button>
        </CreateCardMenu>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("trash.title")}
          title={t("trash.title")}
          onClick={() => setTrashOpen(true)}
        >
          <Trash2 />
        </Button>
      </div>
      <TrashDialog open={trashOpen} onOpenChange={setTrashOpen} />
    </aside>
  );
}
