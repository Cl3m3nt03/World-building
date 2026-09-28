import { Link2 } from "lucide-react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { ChipListener } from "./entityExtension";

type EntityChipProps = {
  chip: NonNullable<Parameters<ChipListener>[0]>;
  onLink: () => void;
};

/**
 * Shown under a detected card name when the caret is on it: "Link to …"
 * turns the name into a mention (also Alt+Enter). The editor keeps the focus.
 */
export function EntityChip({ chip, onLink }: EntityChipProps) {
  const { t } = useTranslation();
  const name = chip.detected.entity.card.title;
  return createPortal(
    <button
      type="button"
      // Keep the focus and the caret in the editor.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onLink}
      className="glass fixed z-50 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs shadow-lg outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
      style={{ top: chip.rect.bottom + 4, left: chip.rect.left }}
    >
      <Link2 aria-hidden className="size-3.5 text-primary" />
      {t("mentions.linkTo", { name })}
      <kbd className="font-mono text-[0.65rem] text-muted-foreground">
        {t("mentions.linkShortcut")}
      </kbd>
    </button>,
    document.body,
  );
}
