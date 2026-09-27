import { useId, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { typeColor, typeIcon } from "@/features/card-types";
import { cn } from "@/lib/utils";
import { useMentionWorld } from "./MentionContext";
import type { SuggestionStore } from "./suggestionStore";

/**
 * The list of cards shown under "@". The editor keeps the focus: arrows move
 * the highlight, Enter or Tab picks, Escape closes (handled by the mention
 * extension); the mouse works too.
 */
export function MentionSuggestions({ store }: { store: SuggestionStore }) {
  const { t } = useTranslation();
  const { types } = useMentionWorld();
  const state = useSyncExternalStore(store.subscribe, store.get);
  const listId = useId();

  if (!state.open) return null;
  const top = (state.rect?.bottom ?? 0) + 4;
  const left = state.rect?.left ?? 0;

  return createPortal(
    <div className="glass fixed z-50 w-72 rounded-lg p-1 text-sm shadow-lg" style={{ top, left }}>
      {state.items.length === 0 ? (
        <p className="px-2 py-1.5 text-muted-foreground">{t("mentions.none")}</p>
      ) : (
        <div id={listId} role="listbox" aria-label={t("mentions.label")}>
          {state.items.map((item, index) => {
            const type = types.find((candidate) => candidate.id === item.card.typeId);
            const Icon = typeIcon(type?.icon ?? "shapes");
            return (
              <div
                key={item.card.id}
                role="option"
                tabIndex={-1}
                aria-selected={index === state.active}
                onMouseEnter={() => store.setActive(index)}
                // Keep the focus (and the "@" query) in the editor.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => store.pick(index)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") store.pick(index);
                }}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5",
                  index === state.active && "bg-accent",
                )}
              >
                <Icon
                  aria-hidden
                  className="size-4 shrink-0"
                  style={{ color: typeColor(type?.color ?? "slate") }}
                />
                <span className="truncate">{item.card.title}</span>
                {item.alias && (
                  <span className="ml-auto truncate text-xs text-muted-foreground">
                    {t("mentions.alias", { alias: item.alias })}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
      <p aria-live="polite" className="sr-only">
        {t("mentions.count", { count: state.items.length })}
      </p>
    </div>,
    document.body,
  );
}
