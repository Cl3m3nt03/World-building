import { useNavigate, useParams } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useUiStore } from "@/app/stores/ui";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { typeColor, typeIcon, useCardTypes } from "@/features/card-types";
import type { CardType } from "@/lib/bindings";
import { cn } from "@/lib/utils";
import { useCreateCard } from "../hooks/useCards";
import { TypePicker } from "./TypePicker";

/**
 * Creates a card of a type and opens it, with its title selected so it can
 * be typed over right away.
 */
export function useCreateCardFlow() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { worldId } = useParams({ from: "/world/$worldId" });
  const create = useCreateCard();
  const setFocusTitle = useUiStore((state) => state.setFocusCardTitle);

  // `mutateAsync`, not `mutate` callbacks: the menu item that starts the
  // creation unmounts when the menu closes, and callbacks of an unmounted
  // caller never run.
  const createCard = (type: CardType) =>
    create
      .mutateAsync({ typeId: type.id, title: t("cards.untitled", { type: type.name }) })
      .then((card) => {
        setFocusTitle(card.id);
        return navigate({
          to: "/world/$worldId/world/card/$cardId",
          params: { worldId, cardId: card.id },
        });
      })
      .catch((error: unknown) => console.warn("Cannot create the card", error));
  return { createCard, create };
}

/** The pieces of the context menu the creation items go in. */
type MenuParts = {
  Item: typeof ContextMenuItem;
  Label: typeof ContextMenuLabel;
  Separator: typeof ContextMenuSeparator;
};
const CONTEXT: MenuParts = {
  Item: ContextMenuItem,
  Label: ContextMenuLabel,
  Separator: ContextMenuSeparator,
};

/**
 * Content of a card creation menu: every type, its subtypes indented under
 * it, and "New type" to open the types screen.
 */
function CreateCardItems({
  parts: { Item, Label, Separator },
  onCreate,
}: {
  parts: MenuParts;
  /** Called when a type is chosen (the menu then closes). */
  onCreate: () => void;
}) {
  const { t } = useTranslation();
  const types = useCardTypes();
  const openTypes = useUiStore((state) => state.setCardTypesOpen);
  const { createCard } = useCreateCardFlow();

  return (
    <>
      <Label>{t("cards.createWhich")}</Label>
      {(types.data ?? []).map((type) => {
        const Icon = typeIcon(type.icon);
        return (
          <Item
            key={type.id}
            onSelect={() => {
              onCreate();
              void createCard(type);
            }}
            className={cn(type.parentId && "pl-8")}
          >
            <Icon aria-hidden style={{ color: typeColor(type.color) }} />
            {type.name}
          </Item>
        );
      })}
      {types.data?.length === 0 && (
        <p className="px-2 py-1.5 text-sm text-muted-foreground">{t("cards.noTypes")}</p>
      )}
      <Separator />
      <Item onSelect={() => openTypes(true)}>
        <Plus />
        {t("cardTypes.newType")}
      </Item>
    </>
  );
}

/**
 * A menu gives focus back to its trigger when it closes. After creating a
 * card, the new card's title must keep it instead (it is selected to be
 * typed over); after Escape, the trigger gets it back as usual.
 */
/**
 * The creation menus close at once, without an exit animation: while a menu
 * fades out, the item under the mouse takes the focus back, so the first
 * letters typed in the new card's title would go to the menu and be lost.
 */
const NO_EXIT_ANIMATION = "w-64 data-[state=closed]:animate-none";

function useKeepNewCardFocus() {
  const created = useRef(false);
  return {
    onCreate: () => {
      created.current = true;
    },
    onCloseAutoFocus: (event: Event) => {
      if (created.current) event.preventDefault();
      created.current = false;
    },
  };
}

/**
 * A button (the `children`, rendered `asChild`) opening the type picker
 * (V2-3.1): type to filter, arrows and Enter to create a card of that type.
 */
export function CreateCardMenu({
  children,
  align = "center",
}: {
  children: ReactNode;
  align?: "start" | "center" | "end";
}) {
  const { t } = useTranslation();
  const types = useCardTypes();
  const { createCard } = useCreateCardFlow();
  const [open, setOpen] = useState(false);
  const focus = useKeepNewCardFocus();
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align={align}
        className="w-auto p-0 data-[state=closed]:animate-none"
        onCloseAutoFocus={focus.onCloseAutoFocus}
      >
        <TypePicker
          title={t("cards.createWhich")}
          types={types.data ?? []}
          onPick={(type) => {
            focus.onCreate();
            setOpen(false);
            void createCard(type);
          }}
          onNewType={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}

/**
 * A zone (the `children`, rendered `asChild`) whose right click opens the
 * card creation menu. `before` / `after` add items around the creation
 * items (the sidebar's folder actions); `create={false}` leaves only them.
 */
export function CreateCardContextMenu({
  children,
  before,
  after,
  create = true,
  createLabel,
  onCloseAutoFocus,
}: {
  children: ReactNode;
  before?: ReactNode;
  after?: ReactNode;
  create?: boolean;
  /** When given, the creation items go in a submenu with this label. */
  createLabel?: string | undefined;
  /** Called when the menu closes, after the new card's focus is kept. */
  onCloseAutoFocus?: (event: Event) => void;
}) {
  const focus = useKeepNewCardFocus();
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent
        // A document menu has entries with longer hints ("Coming with M8").
        className={cn(NO_EXIT_ANIMATION, createLabel && "w-72")}
        onCloseAutoFocus={(event) => {
          focus.onCloseAutoFocus(event);
          onCloseAutoFocus?.(event);
        }}
      >
        {before}
        {before && create && <ContextMenuSeparator />}
        {create &&
          (createLabel ? (
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <Plus />
                {createLabel}
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className={NO_EXIT_ANIMATION}>
                <CreateCardItems parts={CONTEXT} onCreate={focus.onCreate} />
              </ContextMenuSubContent>
            </ContextMenuSub>
          ) : (
            <CreateCardItems parts={CONTEXT} onCreate={focus.onCreate} />
          ))}
        {after && create && <ContextMenuSeparator />}
        {after}
      </ContextMenuContent>
    </ContextMenu>
  );
}
