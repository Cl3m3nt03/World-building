import { useNavigate, useParams } from "@tanstack/react-router";
import { ChevronDown, ImagePlus, MoreHorizontal, Trash2, X } from "lucide-react";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useUiStore } from "@/app/stores/ui";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { typeColor, typeIcon, useCardTypes } from "@/features/card-types";
import { AssetImage, ImagePickerDialog } from "@/features/media";
import { CardProperties } from "@/features/properties";
import type { Card, CardType } from "@/lib/bindings";
import { cn } from "@/lib/utils";
import {
  useCard,
  useMarkOpened,
  useRenameCard,
  useSetCardAliases,
  useSetCardImage,
  useSetCardType,
  useTrashCard,
} from "../hooks/useCards";
import { typeLabel } from "../typeLabel";

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

  useEffect(() => setTitle(card.title), [card.title]);

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

  const save = (value: string) => {
    clearTimeout(timer.current);
    const trimmed = value.trim();
    if (trimmed !== "" && trimmed !== card.title) rename.mutate(trimmed);
  };

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
        onBlur={() => save(title)}
        onKeyDown={(event) => {
          if (event.key === "Enter") save(title);
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

function TypePicker({ card, types }: { card: Card; types: CardType[] }) {
  const { t } = useTranslation();
  const setType = useSetCardType(card.id);
  const current = types.find((type) => type.id === card.typeId);
  const Icon = typeIcon(current?.icon ?? "shapes");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
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
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuRadioGroup
          value={card.typeId ?? ""}
          onValueChange={(typeId) => setType.mutate(typeId)}
        >
          {types.map((type) => {
            const TypeIcon = typeIcon(type.icon);
            return (
              <DropdownMenuRadioItem
                key={type.id}
                value={type.id}
                className={cn(type.parentId && "pl-10")}
              >
                <TypeIcon aria-hidden style={{ color: typeColor(type.color) }} />
                {type.name}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
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
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-bold text-muted-foreground">{t("cards.aliases")}</h2>
      <p className="-mt-1 text-xs text-muted-foreground">{t("cards.aliasesHint")}</p>
      {card.aliases.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {card.aliases.map((alias) => (
            <li
              key={alias}
              className="flex items-center gap-1 rounded-full bg-secondary py-0.5 pr-0.5 pl-3 text-sm"
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
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="flex gap-2">
        <label htmlFor={id} className="sr-only">
          {t("cards.newAlias")}
        </label>
        <Input
          id={id}
          value={draft}
          maxLength={200}
          placeholder={t("cards.newAlias")}
          onChange={(event) => setDraft(event.target.value)}
          className="max-w-72"
        />
        <Button
          type="submit"
          variant="secondary"
          disabled={draft.trim() === "" || setAliases.isPending}
        >
          {t("cards.addAlias")}
        </Button>
      </form>
      {setAliases.isError && <AppErrorMessage error={setAliases.error} />}
    </div>
  );
}

function CardImage({ card, type }: { card: Card; type: CardType | undefined }) {
  const { t } = useTranslation();
  const setImage = useSetCardImage(card.id);
  const [picking, setPicking] = useState(false);
  const landscape = type?.orientation === "landscape";

  return (
    <div className={cn("flex shrink-0 flex-col gap-2", landscape ? "w-72" : "w-44")}>
      <button
        type="button"
        onClick={() => setPicking(true)}
        aria-label={card.imageAssetId ? t("cards.changeImage") : t("cards.chooseImage")}
        className={cn(
          "group relative overflow-hidden rounded-xl border border-border bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          landscape ? "aspect-video" : "aspect-[3/4]",
        )}
      >
        {card.imageAssetId ? (
          <AssetImage assetId={card.imageAssetId} alt="" className="size-full object-cover" />
        ) : (
          <span className="flex size-full flex-col items-center justify-center gap-1 text-xs text-muted-foreground group-hover:text-foreground">
            <ImagePlus aria-hidden className="size-6" />
            {t("cards.chooseImage")}
          </span>
        )}
      </button>
      {card.imageAssetId && (
        <Button variant="ghost" size="sm" onClick={() => setImage.mutate(null)}>
          <X />
          {t("cards.removeImage")}
        </Button>
      )}
      {setImage.isError && <AppErrorMessage error={setImage.error} />}
      <ImagePickerDialog
        open={picking}
        onOpenChange={setPicking}
        selectedId={card.imageAssetId}
        onPick={(assetId) => setImage.mutate(assetId)}
      />
    </div>
  );
}

/** A card, opened in the World tab: image, title, type, aliases. */
export function CardPage() {
  const { t } = useTranslation();
  const { worldId, cardId } = useParams({ from: "/world/$worldId/world/card/$cardId" });
  const navigate = useNavigate();
  const card = useCard(cardId);
  const types = useCardTypes();
  useMarkOpened(cardId);
  const trash = useTrashCard(cardId);
  const all = types.data ?? [];

  if (card.isError) {
    return (
      <div className="p-6">
        <AppErrorMessage error={card.error} />
      </div>
    );
  }
  if (!card.data) return null;
  const type = all.find((candidate) => candidate.id === card.data.typeId);

  return (
    <article
      aria-label={card.data.title}
      className="glass mx-auto flex h-full max-w-4xl flex-col gap-6 overflow-y-auto rounded-lg p-6"
    >
      <header className="flex gap-6">
        <CardImage card={card.data} type={type} />
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <TitleField card={card.data} />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={t("cards.actions")}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
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
          <div>
            <TypePicker card={card.data} types={all} />
          </div>
          <Aliases card={card.data} />
          <CardProperties key={`${card.data.id}-${card.data.typeId}`} cardId={card.data.id} />
          {trash.isError && <AppErrorMessage error={trash.error} />}
        </div>
      </header>
    </article>
  );
}
