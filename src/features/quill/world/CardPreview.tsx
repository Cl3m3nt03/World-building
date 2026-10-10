import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { CardSummary } from "./CardSummary";

/**
 * A card seen while the pointer rests on its name in the text. Clicking the
 * name opens it in the world panel.
 */
export function CardPreview({ cardId, rect }: { cardId: string; rect: DOMRect }) {
  const { t } = useTranslation();
  const below = rect.bottom + 260 < window.innerHeight;
  return createPortal(
    <div
      role="tooltip"
      className="glass pointer-events-none fixed z-50 flex w-72 flex-col gap-1 rounded-lg p-3 shadow-lg"
      style={{
        left: Math.min(rect.left, window.innerWidth - 300),
        ...(below ? { top: rect.bottom + 6 } : { bottom: window.innerHeight - rect.top + 6 }),
      }}
    >
      <CardSummary cardId={cardId} />
      <p className="text-xs text-muted-foreground">{t("quill.preview.open")}</p>
    </div>,
    document.body,
  );
}
