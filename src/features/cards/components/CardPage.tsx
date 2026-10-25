import { useNavigate, useParams } from "@tanstack/react-router";
import {
  BookOpen,
  ChevronDown,
  Eye,
  EyeOff,
  Globe,
  ListChecks,
  MoreHorizontal,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useUiStore } from "@/app/stores/ui";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { typeColor, typeIcon, useCardTypes } from "@/features/card-types";
import { useSetWikiVisible, useWikiPages } from "@/features/wiki/hooks/useWiki";
import type { Card, CardType } from "@/lib/bindings";
import { wikiCardRoute } from "@/lib/documentRoute";
import { usePendingSave } from "@/lib/pendingSaves";
import type { BlockEditorHandle } from "../blocks/BlockEditor";
import { effectiveTemplate } from "../blocks/template";
import {
  useCard,
  useMarkOpened,
  useRenameCard,
  useSetCardAliases,
  useSetCardType,
  useTrashCard,
} from "../hooks/useCards";
import { typeLabel } from "../typeLabel";
import { Backlinks } from "./Backlinks";
import { CardContent } from "./CardContent";
import { CardImage } from "./CardImage";
import { CardProperties } from "./CardProperties";
import { TypePicker } from "./TypePicker";

/** Delay before a typed title is saved. */
const SAVE_DELAY_MS = 500;

function TitleField({ card }: { card: Card }) {
  const { t } = useTranslation();
  const rename = useRenameCard(card.id);
  const [title, setTitle] = useState(card.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const focusTitleOf = useUiStore((state) => state.focusCardTitle);
  const setFocusTitle = useUiStore((state) => state.setFocusCardTitle);
  const id = useId();

  // While the field is being edited, the title saved a moment ago coming
  // back from the Rust side must not replace what has been typed since.
  const editing = useRef(false);
  useEffect(() => {
    if (!editing.current) setTitle(card.title);
  }, [card.title]);

  // A card that was just created opens with its title selected. One frame
  // later: the creation menu is still closing and would move the caret.
  useEffect(() => {
    if (focusTitleOf !== card.id) return;
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
      setFocusTitle(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [focusTitleOf, card.id, setFocusTitle]);

  // Returns the save, awaited before the world or the window closes.
  const save = (value: string) => {
    clearTimeout(timer.current);
    const trimmed = value.trim();
    if (trimmed === "" || trimmed === card.title) return undefined;
    // A failure is shown under the title (`rename.error`).
    return rename.mutateAsync(trimmed).catch(() => {});
  };
  usePendingSave(() => save(title));

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="sr-only">
        {t("cards.title")}
      </label>
      <Input
        id={id}
        ref={inputRef}
        value={title}
        maxLength={200}
        aria-invalid={title.trim() === ""}
        onChange={(event) => {
          const value = event.target.value;
          setTitle(value);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => save(value), SAVE_DELAY_MS);
        }}
        onFocus={() => {
          editing.current = true;
        }}
        onBlur={() => {
          editing.current = false;
          void save(title);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") void save(title);
        }}
        className="h-auto border-transparent bg-transparent px-1 py-1 font-heading text-3xl font-bold shadow-none hover:border-border focus-visible:border-ring md:text-3xl dark:bg-transparent"
      />
      {title.trim() === "" && (
        <p className="px-1 text-xs text-destructive">{t("cards.titleRequired")}</p>
      )}
      {rename.isError && <AppErrorMessage error={rename.error} />}
    </div>
  );
}

/** The card's type chip: it opens the type picker, the current type marked (V2-3.1). */
function CardTypeChip({ card, types }: { card: Card; types: CardType[] }) {
  const { t } = useTranslation();
  const setType = useSetCardType(card.id);
  const [open, setOpen] = useState(false);
  const current = types.find((type) => type.id === card.typeId);
  const Icon = typeIcon(current?.icon ?? "shapes");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          className="rounded-full"
          aria-label={t("cards.changeType", { type: current ? typeLabel(current, types) : "" })}
        >
          <Icon style={{ color: typeColor(current?.color ?? "slate") }} />
          {current ? typeLabel(current, types) : t("cards.noType")}
          <ChevronDown />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <TypePicker
          title={t("typePicker.changeTitle")}
          types={types}
          current={card.typeId}
          onPick={(type) => {
            setOpen(false);
            if (type.id !== card.typeId) setType.mutate(type.id);
          }}
          onNewType={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}

function Aliases({ card }: { card: Card }) {
  const { t } = useTranslation();
  const setAliases = useSetCardAliases(card.id);
  const [draft, setDraft] = useState("");
  const id = useId();

  const add = (event: FormEvent) => {
    event.preventDefault();
    const alias = draft.trim();
    if (alias === "") return;
    setAliases.mutate([...card.aliases, alias], { onSuccess: () => setDraft("") });
  };

  return (
    // One compact line (V2-3.2, after vvd): the aliases as pills, then a small field.
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1.5" title={t("cards.aliasesHint")}>
        <span className="rubric flex items-center gap-1">
          <Tag aria-hidden className="size-3.5" />
          {t("cards.aliases")}
        </span>
        {card.aliases.map((alias) => (
          <span
            key={alias}
            className="flex items-center gap-0.5 rounded-full bg-secondary py-0.5 pr-0.5 pl-2.5 text-sm"
          >
            {alias}
            <Button
              variant="ghost"
              size="icon-xs"
              className="rounded-full"
              aria-label={t("cards.removeAlias", { alias })}
              onClick={() => setAliases.mutate(card.aliases.filter((other) => other !== alias))}
            >
              <X />
            </Button>
          </span>
        ))}
        <form onSubmit={add} className="flex items-center gap-1">
          <label htmlFor={id} className="sr-only">
            {t("cards.newAlias")}
          </label>
          <input
            id={id}
            value={draft}
            maxLength={200}
            placeholder={t("cards.addAliasShort")}
            onChange={(event) => setDraft(event.target.value)}
            className="h-6 w-28 rounded-full border border-dashed border-border bg-transparent px-2.5 text-sm outline-none placeholder:text-muted-foreground focus:w-44 focus:border-solid focus:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 transition-[width,border-color] duration-(--bz-duration-fast) ease-atlas"
          />
          {draft.trim() !== "" && (
            <Button
              type="submit"
              variant="secondary"
              size="xs"
              className="rounded-full"
              disabled={setAliases.isPending}
            >
              {t("cards.addAlias")}
            </Button>
          )}
        </form>
      </div>
      {setAliases.isError && <AppErrorMessage error={setAliases.error} />}
    </div>
  );
}

/** A card, opened in the World tab: title, type, wiki visibility, aliases, its portrait on the right (V2-3.2). */
export function CardPage() {
  const { t } = useTranslation();
  const { worldId, cardId } = useParams({ from: "/world/$worldId/world/card/$cardId" });
  const navigate = useNavigate();
  const card = useCard(cardId);
  const types = useCardTypes();
  useMarkOpened(cardId);
  const trash = useTrashCard(cardId);
  const wikiPages = useWikiPages();
  const setWikiVisible = useSetWikiVisible();
  const inWiki = wikiPages.data?.some((page) => page.id === cardId) ?? false;
  const all = types.data ?? [];
  const blocksRef = useRef<BlockEditorHandle>(null);

  if (card.isError) {
    return (
      <div className="p-6">
        <AppErrorMessage error={card.error} />
      </div>
    );
  }
  if (!card.data) return null;
  const type = all.find((candidate) => candidate.id === card.data.typeId);
  const template = effectiveTemplate(type, all);
  // The type the template comes from (a subtype may use its parent's).
  const templateSource =
    type && type.guidedTemplate.length === 0 && type.parentId
      ? all.find((candidate) => candidate.id === type.parentId)
      : type;

  return (
    <article
      aria-label={card.data.title}
      className="glass mx-auto flex h-full max-w-4xl flex-col gap-6 overflow-y-auto rounded-lg p-6"
    >
      <header className="flex gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex flex-wrap items-start gap-2">
            <div className="min-w-0 flex-1 basis-64">
              {/* One field per card: a field kept from the previous card would
                  show its title for a moment, and the update to the new one
                  would drop the selection of a new card's title. */}
              <TitleField key={card.data.id} card={card.data} />
            </div>
            <div className="flex items-center gap-1 pt-1.5">
              <CardTypeChip card={card.data} types={all} />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="rounded-full"
                    aria-label={t("sidebar.document.wiki")}
                    aria-pressed={inWiki}
                    onClick={() => setWikiVisible.mutate({ id: cardId, visible: !inWiki })}
                  >
                    {inWiki ? <Eye /> : <EyeOff className="text-muted-foreground" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {inWiki ? t("cards.wikiVisible") : t("cards.wikiHidden")}
                </TooltipContent>
              </Tooltip>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={t("cards.actions")}>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuCheckboxItem
                    checked={inWiki}
                    onCheckedChange={(checked) =>
                      setWikiVisible.mutate({ id: cardId, visible: checked === true })
                    }
                  >
                    <Globe />
                    {t("sidebar.document.wiki")}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuItem
                    disabled={!inWiki}
                    onSelect={() => void navigate(wikiCardRoute(worldId, cardId))}
                  >
                    <BookOpen />
                    {t("wiki.openInWiki")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={template.length === 0}
                    onSelect={() => blocksRef.current?.applyTemplate()}
                  >
                    <ListChecks />
                    {template.length > 0
                      ? t("templates.apply", { type: templateSource?.name ?? "" })
                      : t("templates.none")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() =>
                      trash.mutate(undefined, {
                        onSuccess: () =>
                          void navigate({ to: "/world/$worldId/world", params: { worldId } }),
                      })
                    }
                  >
                    <Trash2 />
                    {t("cards.trash")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <Aliases card={card.data} />
          <CardProperties key={`${card.data.id}-${card.data.typeId}`} cardId={card.data.id} />
          {trash.isError && <AppErrorMessage error={trash.error} />}
        </div>
        {/* The portrait on the right, after vvd. */}
        <CardImage card={card.data} type={type} />
      </header>
      <CardContent
        ref={blocksRef}
        card={card.data}
        open={(id) =>
          void navigate({
            to: "/world/$worldId/world/card/$cardId",
            params: { worldId, cardId: id },
          })
        }
      />
      <Backlinks cardId={card.data.id} />
    </article>
  );
}
