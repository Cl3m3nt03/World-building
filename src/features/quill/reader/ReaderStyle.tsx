import { Check } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FONT_NAMES, WIKI_FONTS, type WikiFontKey } from "@/features/wiki";
import type {
  ChapterLayout,
  PageTheme,
  ReaderSettings,
  ReadingMode,
  TextSize,
} from "@/lib/bindings";
import { PAGE_BACKGROUNDS, PAGE_THEMES } from "./settings";

const THEMES: PageTheme[] = ["light", "sepia", "dark"];
const MODES: ReadingMode[] = ["scroll", "pages"];
const SIZES: TextSize[] = ["small", "medium", "large"];
const LAYOUTS: ChapterLayout[] = ["imageAbove", "titleOver", "noImage"];
const FONTS = Object.keys(WIKI_FONTS) as WikiFontKey[];

const swatch =
  "flex size-7 items-center justify-center rounded-full border border-border outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:ring-2 aria-pressed:ring-primary";

/** A choice among a few values, as radio buttons on a line. */
function Choice<T extends string>({
  legend,
  value,
  values,
  label,
  onChange,
}: {
  legend: string;
  value: T;
  values: T[];
  label: (value: T) => string;
  onChange: (value: T) => void;
}) {
  const id = useId();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-sm font-medium">{legend}</legend>
      <RadioGroup
        value={value}
        onValueChange={(next) => onChange(next as T)}
        className="flex flex-wrap gap-x-4 gap-y-2"
      >
        {values.map((item) => (
          <div key={item} className="flex items-center gap-2">
            <RadioGroupItem value={item} id={`${id}-${item}`} />
            <Label htmlFor={`${id}-${item}`}>{label(item)}</Label>
          </div>
        ))}
      </RadioGroup>
    </fieldset>
  );
}

type Props = {
  settings: ReaderSettings;
  onChange: (patch: Partial<ReaderSettings>) => void;
  error?: unknown;
};

/**
 * The Style tab of the publishing panel: how the book reads. Each change
 * shows at once in the preview and is kept with the story.
 */
export function ReaderStyle({ settings, onChange, error }: Props) {
  const { t } = useTranslation();
  const backgrounds = [null, ...PAGE_BACKGROUNDS];
  return (
    <div className="flex flex-col gap-5 p-4">
      <Choice
        legend={t("quill.reader.theme")}
        value={settings.theme}
        values={THEMES}
        label={(theme) => t(`quill.reader.themes.${theme}`)}
        onChange={(theme) => onChange({ theme, background: null })}
      />
      <Choice
        legend={t("quill.reader.mode")}
        value={settings.mode}
        values={MODES}
        label={(mode) => t(`quill.reader.modes.${mode}`)}
        onChange={(mode) => onChange({ mode })}
      />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium">{t("quill.reader.background")}</legend>
        <div className="flex flex-wrap items-center gap-2">
          {backgrounds.map((color) => {
            const shown = color ?? PAGE_THEMES[settings.theme].page;
            const pressed = settings.background === color;
            return (
              <button
                key={color ?? "theme"}
                type="button"
                aria-label={
                  color
                    ? t("quill.reader.backgroundValue", { color })
                    : t("quill.reader.backgroundTheme")
                }
                aria-pressed={pressed}
                onClick={() => onChange({ background: color })}
                className={swatch}
                style={{ backgroundColor: shown }}
              >
                {pressed && (
                  <Check aria-hidden className="size-3.5 text-white mix-blend-difference" />
                )}
              </button>
            );
          })}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium">{t("quill.reader.font")}</legend>
        <div className="grid grid-cols-3 gap-2">
          {FONTS.map((font) => (
            <button
              key={font}
              type="button"
              aria-pressed={settings.font === font}
              onClick={() => onChange({ font })}
              className="flex flex-col items-center gap-0.5 rounded-md border border-border px-2 py-1.5 outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:border-primary aria-pressed:bg-secondary"
            >
              <span aria-hidden className="text-lg" style={{ fontFamily: WIKI_FONTS[font] }}>
                {t("quill.reader.fontSample")}
              </span>
              <span className="truncate text-xs">{FONT_NAMES[font]}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <Choice
        legend={t("quill.reader.size")}
        value={settings.textSize}
        values={SIZES}
        label={(size) => t(`quill.reader.sizes.${size}`)}
        onChange={(textSize) => onChange({ textSize })}
      />
      <Choice
        legend={t("quill.reader.layout")}
        value={settings.chapterLayout}
        values={LAYOUTS}
        label={(layout) => t(`quill.reader.layouts.${layout}`)}
        onChange={(chapterLayout) => onChange({ chapterLayout })}
      />
      {error ? <AppErrorMessage error={error} /> : null}
    </div>
  );
}
