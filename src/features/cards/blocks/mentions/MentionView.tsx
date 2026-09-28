import { NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import { useTranslation } from "react-i18next";
import { typeColor, typeIcon } from "@/features/card-types";
import { forgetFresh, isFresh } from "./fresh";
import { useMentionWorld } from "./MentionContext";

/**
 * A mention in a text block. It shows the card's current name (renaming the
 * card updates it) and opens the card on click. A mention of a card in the
 * trash or deleted shows the name it had, struck through, as a dead reference.
 */
export function MentionView({ node }: ReactNodeViewProps) {
  const { t } = useTranslation();
  const { cards, trashed, types, open } = useMentionWorld();
  const id = typeof node.attrs.id === "string" ? node.attrs.id : "";
  const savedLabel = typeof node.attrs.label === "string" ? node.attrs.label : "";
  const card = cards.find((candidate) => candidate.id === id);

  if (!card) {
    // In the trash: its latest name. Deleted for good: the name it had here.
    const name = trashed.find((candidate) => candidate.id === id)?.title ?? savedLabel;
    return (
      <NodeViewWrapper
        as="span"
        className="mention mention-dead"
        title={t("mentions.dead")}
        aria-label={t("mentions.deadNamed", { name })}
      >
        {name}
      </NodeViewWrapper>
    );
  }

  const type = types.find((candidate) => candidate.id === card.typeId);
  const Icon = typeIcon(type?.icon ?? "shapes");
  return (
    <NodeViewWrapper
      as="span"
      className={isFresh(node) ? "mention mention-fresh" : "mention"}
      onAnimationEnd={() => forgetFresh(node)}
    >
      <a
        href={`#card-${card.id}`}
        aria-label={t("mentions.open", { name: card.title })}
        onClick={(event) => {
          event.preventDefault();
          open(card.id);
        }}
        className="mention-link"
      >
        <Icon
          aria-hidden
          className="size-3.5"
          style={{ color: typeColor(type?.color ?? "slate") }}
        />
        {card.title}
      </a>
    </NodeViewWrapper>
  );
}
