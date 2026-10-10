import { Link, useParams } from "@tanstack/react-router";
import { ExternalLink, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import { useCardTypes } from "@/features/card-types";
import { Backlinks, CardContent, CardImage, CardProperties, useCard } from "@/features/cards";

/**
 * A card open next to the text (the world panel's card, until the panel's
 * tabs come, 9.7): the same card as in World, edited here.
 */
export function CardPanel({
  cardId,
  onOpen,
  onClose,
}: {
  cardId: string;
  /** Opens another card here (a mention in this card's text). */
  onOpen: (cardId: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { worldId } = useParams({ from: "/world/$worldId" });
  const card = useCard(cardId);
  const types = useCardTypes();
  if (card.error) return <AppErrorMessage error={card.error} />;
  if (!card.data) return null;
  const type = types.data?.find((candidate) => candidate.id === card.data.typeId);

  return (
    <aside
      aria-label={t("quill.panel.card", { name: card.data.title })}
      className="flex min-h-0 flex-col gap-3 border-l border-border pl-4"
    >
      <div className="flex items-center gap-1">
        <h2 className="min-w-0 flex-1 truncate font-heading text-lg font-bold">
          {card.data.title}
        </h2>
        <Button asChild variant="ghost" size="icon-sm" aria-label={t("quill.panel.openInWorld")}>
          <Link to="/world/$worldId/world/card/$cardId" params={{ worldId, cardId }}>
            <ExternalLink />
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("quill.panel.close")}
          onClick={onClose}
        >
          <X />
        </Button>
      </div>
      <div className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
        <CardImage card={card.data} type={type} className="w-32" />
        <CardProperties key={`${card.data.id}-${card.data.typeId}`} cardId={card.data.id} />
        <CardContent card={card.data} open={onOpen} />
        <Backlinks cardId={card.data.id} />
      </div>
    </aside>
  );
}
