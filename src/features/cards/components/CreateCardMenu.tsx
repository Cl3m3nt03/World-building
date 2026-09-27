import { useNavigate, useParams } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { type ReactNode, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useUiStore } from "@/app/stores/ui";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { typeColor, typeIcon, useCardTypes } from "@/features/card-types";
import type { CardType } from "@/lib/bindings";
import { cn } from "@/lib/utils";
import { useCreateCard } from "../hooks/useCards";

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

/** The pieces of a menu kind (dropdown or context menu). */
type MenuParts = {
  Item: typeof DropdownMenuItem | typeof ContextMenuItem;
  Label: typeof DropdownMenuLabel | typeof ContextMenuLabel;
  Separator: typeof DropdownMenuSeparator | typeof ContextMenuSeparator;
};

const DROPDOWN: MenuParts = {
  Item: DropdownMenuItem,
  Label: DropdownMenuLabel,
  Separator: DropdownMenuSeparator,
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

/** A button (the `children`, rendered `asChild`) opening the card creation menu. */
export function CreateCardMenu({
  children,
  align = "center",
}: {
  children: ReactNode;
  align?: "start" | "center" | "end";
}) {
  const focus = useKeepNewCardFocus();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-64" onCloseAutoFocus={focus.onCloseAutoFocus}>
        <CreateCardItems parts={DROPDOWN} onCreate={focus.onCreate} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** A zone (the `children`, rendered `asChild`) whose right click opens the card creation menu. */
export function CreateCardContextMenu({ children }: { children: ReactNode }) {
  const focus = useKeepNewCardFocus();
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-64" onCloseAutoFocus={focus.onCloseAutoFocus}>
        <CreateCardItems parts={CONTEXT} onCreate={focus.onCreate} />
      </ContextMenuContent>
    </ContextMenu>
  );
}
