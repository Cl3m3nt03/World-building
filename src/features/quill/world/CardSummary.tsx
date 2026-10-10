import { useQuery } from "@tanstack/react-query";
import type { JSONContent } from "@tiptap/react";
import { useTranslation } from "react-i18next";
import { typeColor, typeIcon, useCardTypes } from "@/features/card-types";
import { cardKeys, parseContent, typeLabel, useCardList } from "@/features/cards";
import { AssetImage } from "@/features/media";
import { commands } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";
import { cn } from "@/lib/utils";
import { paragraphs } from "../drafts/diff";

/** Characters of a card's text shown in its summary. */
const EXCERPT = 220;

/**
 * A card in short: image, name, type, other names and the start of its text
 * (the preview on a name, a card block of the world panel).
 */
export function CardSummary({ cardId, className }: { cardId: string; className?: string }) {
  const { t } = useTranslation();
  const cards = useCardList(false);
  const types = useCardTypes();
  const card = cards.data?.find((candidate) => candidate.id === cardId);
  const text = useQuery({
    queryKey: [...cardKeys.detail(cardId), "content"],
    queryFn: async () => parseContent(await unwrap(commands.getCardContent(cardId))),
    staleTime: Number.POSITIVE_INFINITY,
  });
  if (!card) {
    return <p className="text-sm text-muted-foreground">{t("quill.preview.missing")}</p>;
  }
  const all = types.data ?? [];
  const type = all.find((candidate) => candidate.id === card.typeId);
  const Icon = typeIcon(type?.icon ?? "shapes");
  const excerpt = (text.data ?? [])
    .flatMap((block) => (block.type === "text" ? paragraphs(block.doc as JSONContent) : []))
    .join(" ");
  return (
    <div className={cn("flex gap-3 text-sm", className)}>
      {card.imageAssetId && (
        <AssetImage
          assetId={card.imageAssetId}
          alt=""
          className="h-24 w-16 shrink-0 rounded-md object-cover"
        />
      )}
      <div className="flex min-w-0 flex-col gap-1">
        <p className="truncate font-bold">{card.title}</p>
        {type && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Icon aria-hidden className="size-3.5" style={{ color: typeColor(type.color) }} />
            {typeLabel(type, all)}
          </p>
        )}
        {card.aliases.length > 0 && (
          <p className="truncate text-xs text-muted-foreground">
            {t("quill.preview.aliases", { aliases: card.aliases.join(", ") })}
          </p>
        )}
        {excerpt && (
          <p className="line-clamp-4 text-xs">
            {excerpt.length > EXCERPT ? `${excerpt.slice(0, EXCERPT)}…` : excerpt}
          </p>
        )}
      </div>
    </div>
  );
}
