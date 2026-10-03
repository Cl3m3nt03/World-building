import { Map as MapIcon, Network, Share2, UserRound } from "lucide-react";
import { type ReactNode, useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChoiceTiles } from "@/features/card-types";
import { useCardList } from "@/features/cards";
import type { TranslationKey } from "@/i18n";
import { EMBED_KINDS, type Embed, type EmbedKind } from "../embeds";
import { useWorldDocuments } from "../hooks/useWorldDocuments";

const KINDS: Record<EmbedKind, { label: TranslationKey; icon: typeof MapIcon }> = {
  card: { label: "canvases.insert.kind.card", icon: UserRound },
  map: { label: "canvases.insert.kind.map", icon: MapIcon },
  graph: { label: "canvases.insert.kind.graph", icon: Share2 },
  tree: { label: "canvases.insert.kind.tree", icon: Network },
};

/** Most documents listed at once (the search narrows them). */
const SHOWN = 50;

/** The world's live documents of a kind, by title, matching a search. */
function useChoices(kind: EmbedKind, search: string) {
  const cards = useCardList(false);
  const documents = useWorldDocuments(kind === "card" ? "map" : kind);
  const query = search.trim().toLocaleLowerCase();
  return useMemo(() => {
    const all =
      kind === "card"
        ? (cards.data ?? []).map((card) => ({
            id: card.id,
            title: card.title,
            names: [card.title, ...card.aliases],
          }))
        : (documents.data ?? []).map((doc) => ({
            id: doc.id,
            title: doc.title,
            names: [doc.title],
          }));
    return all
      .filter((each) => each.names.some((name) => name.toLocaleLowerCase().includes(query)))
      .sort((a, b) => a.title.localeCompare(b.title))
      .slice(0, SHOWN);
  }, [kind, cards.data, documents.data, query]);
}

/**
 * The « Insert » tool (as on the board): a popover above the bar to choose
 * a card, a map, a graph or a tree of the world, searched by name; the
 * chosen one is placed in the middle of the view.
 */
export function InsertPicker({
  onInsert,
  children,
}: {
  onInsert: (embed: Embed) => void;
  /** The trigger. */
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<EmbedKind>("card");
  const [search, setSearch] = useState("");
  const choices = useChoices(kind, search);
  const listId = useId();
  const pick = (id: string) => {
    onInsert({ kind, id });
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        side="top"
        className="glass flex w-80 flex-col gap-2 p-2"
        // Escape closes the popover only: Excalidraw would also drop the tool.
        onEscapeKeyDown={(event) => event.stopPropagation()}
      >
        <ChoiceTiles
          label={t("canvases.insert.kindLabel")}
          value={kind}
          onChange={setKind}
          className="flex-nowrap gap-1"
          tileClassName="h-14 flex-1 flex-col gap-1 text-xs"
          choices={EMBED_KINDS.map((value) => {
            const Icon = KINDS[value].icon;
            return {
              value,
              label: t(KINDS[value].label),
              content: (
                <>
                  <Icon aria-hidden className="size-5" />
                  {t(KINDS[value].label)}
                </>
              ),
            };
          })}
        />
        <Input
          autoFocus
          aria-label={t("canvases.insert.search")}
          aria-controls={listId}
          placeholder={t("canvases.insert.search")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            const first = choices[0];
            if (event.key === "Enter" && first) {
              event.preventDefault();
              pick(first.id);
            }
          }}
        />
        <ul id={listId} aria-label={t(KINDS[kind].label)} className="max-h-56 overflow-y-auto">
          {choices.map((choice) => (
            <li key={choice.id}>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => pick(choice.id)}
              >
                <span className="truncate">{choice.title}</span>
              </Button>
            </li>
          ))}
          {choices.length === 0 && (
            <li className="px-2 py-3 text-center text-sm text-muted-foreground">
              {t("canvases.insert.none")}
            </li>
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
