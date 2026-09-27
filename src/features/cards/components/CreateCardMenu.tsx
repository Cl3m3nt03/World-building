import { useNavigate, useParams } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useUiStore } from "@/app/stores/ui";
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

  const createCard = (type: CardType) =>
    create.mutate(
      { typeId: type.id, title: t("cards.untitled", { type: type.name }) },
      {
        onSuccess: (card) => {
          setFocusTitle(card.id);
          void navigate({
            to: "/world/$worldId/world/card/$cardId",
            params: { worldId, cardId: card.id },
          });
        },
      },
    );
  return { createCard, create };
}

function TypeItem({ type, onSelect }: { type: CardType; onSelect: () => void }) {
  const Icon = typeIcon(type.icon);
  return (
    <DropdownMenuItem onSelect={onSelect} className={cn(type.parentId && "pl-8")}>
      <Icon aria-hidden style={{ color: typeColor(type.color) }} />
      {type.name}
    </DropdownMenuItem>
  );
}

/**
 * Menu to create a card: every type, its subtypes indented under it, and
 * "New type" to open the types screen.
 */
export function CreateCardMenu({
  children,
  align = "center",
}: {
  /** The trigger (rendered with `asChild`). */
  children: ReactNode;
  align?: "start" | "center" | "end";
}) {
  const { t } = useTranslation();
  const types = useCardTypes();
  const openTypes = useUiStore((state) => state.setCardTypesOpen);
  const { createCard } = useCreateCardFlow();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-64">
        <DropdownMenuLabel>{t("cards.createWhich")}</DropdownMenuLabel>
        {(types.data ?? []).map((type) => (
          <TypeItem key={type.id} type={type} onSelect={() => createCard(type)} />
        ))}
        {types.data?.length === 0 && (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">{t("cards.noTypes")}</p>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => openTypes(true)}>
          <Plus />
          {t("cardTypes.newType")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
