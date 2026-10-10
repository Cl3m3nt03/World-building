import {
  BookOpenText,
  Globe,
  type LucideIcon,
  Music,
  PenLine,
  Play,
  Smartphone,
  Tablet,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Template } from "../reader/ReaderView";

/** What the writing space is for: writing, placing sounds, reading with them, publishing. */
export type Mode = "write" | "audio" | "play" | "publish";

export const MODES: Mode[] = ["write", "audio", "play", "publish"];

const MODE_ICONS: Record<Mode, LucideIcon> = {
  write: PenLine,
  audio: Music,
  play: Play,
  publish: BookOpenText,
};

const TEMPLATE_ICONS: Record<Template, LucideIcon> = {
  web: Globe,
  mobile: Smartphone,
  ereader: Tablet,
};

/** A mode read from the address (writing when unknown). */
export function readMode(value: unknown): Mode {
  return MODES.includes(value as Mode) ? (value as Mode) : "write";
}

type Props = {
  mode: Mode;
  /** The modes offered (the others come with M10's later steps). */
  modes: Mode[];
  onMode: (mode: Mode) => void;
  /** In the publish mode: the device the book is previewed on. */
  template?: Template | undefined;
  onTemplate?: ((template: Template) => void) | undefined;
};

/**
 * The bar under the text (board: « Play », « Audio », « Write »,
 * « Publish », and the devices of the preview when publishing).
 */
export function ModeBar({ mode, modes, onMode, template, onTemplate }: Props) {
  const { t } = useTranslation();
  return (
    <div className="glass flex items-center gap-2 rounded-full px-2 py-1 shadow-md">
      {mode === "publish" && template && onTemplate && (
        <>
          <ToggleGroup
            type="single"
            value={template}
            onValueChange={(value) => value && onTemplate(value as Template)}
            aria-label={t("quill.modes.templates")}
          >
            {(["web", "mobile", "ereader"] as const).map((item) => {
              const Icon = TEMPLATE_ICONS[item];
              return (
                <ToggleGroupItem key={item} value={item} className="gap-1.5 px-2.5">
                  <Icon aria-hidden />
                  {t(`quill.reader.templates.${item}`)}
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
          <span aria-hidden className="h-5 w-px bg-border" />
        </>
      )}
      <ToggleGroup
        type="single"
        value={mode}
        onValueChange={(value) => value && onMode(value as Mode)}
        aria-label={t("quill.modes.label")}
      >
        {modes.map((item) => {
          const Icon = MODE_ICONS[item];
          return (
            <ToggleGroupItem key={item} value={item} className="gap-1.5 px-2.5">
              <Icon aria-hidden />
              {t(`quill.modes.${item}`)}
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
    </div>
  );
}
