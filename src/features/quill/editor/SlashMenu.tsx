import { Heading1, Heading2, Heading3, ImagePlus, Minus, Quote } from "lucide-react";
import { useId, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { SlashCommand } from "./extensions";
import type { ListStore } from "./listStore";

const ICONS: Record<SlashCommand, typeof Quote> = {
  heading1: Heading1,
  heading2: Heading2,
  heading3: Heading3,
  divider: Minus,
  quote: Quote,
  image: ImagePlus,
};

/**
 * The "/" commands under the caret. The editor keeps the focus: arrows move
 * the highlight, Enter or Tab picks, Escape closes; the mouse works too.
 */
export function SlashMenu({ store }: { store: ListStore<SlashCommand> }) {
  const { t } = useTranslation();
  const state = useSyncExternalStore(store.subscribe, store.get);
  const listId = useId();
  if (!state.open) return null;
  const top = (state.rect?.bottom ?? 0) + 4;
  const left = state.rect?.left ?? 0;

  return createPortal(
    <div className="glass fixed z-50 w-64 rounded-lg p-1 text-sm shadow-lg" style={{ top, left }}>
      {state.items.length === 0 ? (
        <p className="px-2 py-1.5 text-muted-foreground">{t("quill.slash.none")}</p>
      ) : (
        <div id={listId} role="listbox" aria-label={t("quill.slash.label")}>
          {state.items.map((command, index) => {
            const Icon = ICONS[command];
            return (
              <div
                key={command}
                role="option"
                tabIndex={-1}
                aria-selected={index === state.active}
                onMouseEnter={() => store.setActive(index)}
                // Keep the focus (and the "/" query) in the editor.
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
                <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                {t(`quill.slash.${command}`)}
              </div>
            );
          })}
        </div>
      )}
    </div>,
    document.body,
  );
}
