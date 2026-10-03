import { Palette, RotateCcw, Save, X } from "lucide-react";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { WikiPalette, WikiSettings, WikiTheme } from "@/lib/bindings";
import { cn } from "@/lib/utils";
import { useSaveWikiSettings } from "../hooks/useWiki";
import {
  contrast,
  FONT_NAMES,
  MIN_TEXT_CONTRAST,
  PRESET_KEYS,
  presetKey,
  resolveTheme,
  WIKI_FONTS,
  WIKI_PRESETS,
  type WikiFontKey,
} from "../theme";
import { WIKI_BUTTON } from "./styles";

/** Pause after the last colour change before saving, in milliseconds. */
const SAVE_DELAY_MS = 300;

/** Most palettes kept (the Rust side checks it too). */
const MAX_SAVED_PALETTES = 50;

const COLORS = ["background", "surface", "text", "muted", "accent"] as const;

const FONT_KEYS = Object.keys(WIKI_FONTS) as WikiFontKey[];

/**
 * « Style du site », at the bottom of the wiki: its theme (provided themes
 * and saved palettes), its colours one by one, and its fonts. Applied to the
 * wiki only, at once, and kept.
 */
export function SiteStyle({ settings }: { settings: WikiSettings }) {
  const { t } = useTranslation();
  const save = useSaveWikiSettings();
  const theme = settings.theme;
  const setTheme = (change: Partial<WikiTheme>) =>
    save.mutate({ ...settings, theme: { ...theme, ...change } });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(WIKI_BUTTON, "absolute bottom-3 left-1/2 -translate-x-1/2 shadow-md")}
        >
          <Palette aria-hidden />
          {t("wiki.style.open")}
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="flex w-96 flex-col gap-3 p-3">
        <h2 className="text-sm font-bold">{t("wiki.style.title")}</h2>
        {save.error && <AppErrorMessage error={save.error} />}
        <Tabs defaultValue="themes">
          <TabsList className="w-full">
            <TabsTrigger value="themes">{t("wiki.style.themes")}</TabsTrigger>
            <TabsTrigger value="colors">{t("wiki.style.colors")}</TabsTrigger>
            <TabsTrigger value="fonts">{t("wiki.style.fonts")}</TabsTrigger>
          </TabsList>
          <TabsContent value="themes" className="pt-2">
            <Themes theme={theme} onChange={setTheme} />
          </TabsContent>
          <TabsContent value="colors" className="pt-2">
            <Colors theme={theme} onChange={setTheme} />
          </TabsContent>
          <TabsContent value="fonts" className="pt-2">
            <Fonts theme={theme} onChange={setTheme} />
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}

type TabProps = { theme: WikiTheme; onChange: (change: Partial<WikiTheme>) => void };

function Swatches({ palette }: { palette: WikiPalette }) {
  return (
    <span aria-hidden className="flex overflow-hidden rounded-sm border border-border">
      {COLORS.map((color) => (
        <span key={color} className="size-4" style={{ backgroundColor: palette[color] }} />
      ))}
    </span>
  );
}

/** The provided themes, then the saved palettes. */
function Themes({ theme, onChange }: TabProps) {
  const { t } = useTranslation();
  const current = presetKey(theme);
  const custom = theme.palette ?? null;
  const saved = theme.savedPalettes ?? [];
  return (
    <div className="flex flex-col gap-3">
      <ul className="grid grid-cols-2 gap-2">
        {PRESET_KEYS.map((key) => {
          const preset = WIKI_PRESETS[key];
          const active = key === current && !custom && !theme.headingFont && !theme.bodyFont;
          return (
            <li key={key}>
              <button
                type="button"
                aria-pressed={active}
                // A provided theme brings its colours and fonts back.
                onClick={() =>
                  onChange({ preset: key, palette: null, headingFont: null, bodyFont: null })
                }
                className="flex w-full flex-col gap-1.5 rounded-md border border-border p-2 text-left outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:border-primary aria-pressed:ring-1 aria-pressed:ring-primary"
                style={{
                  backgroundColor: preset.palette.background,
                  color: preset.palette.text,
                }}
              >
                <span
                  className="text-base font-bold"
                  style={{
                    fontFamily: WIKI_FONTS[preset.headingFont],
                    color: preset.palette.accent,
                  }}
                >
                  {t(`wiki.style.presets.${key}`)}
                </span>
                <Swatches palette={preset.palette} />
              </button>
            </li>
          );
        })}
      </ul>
      {saved.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <h3 className="text-xs font-bold text-muted-foreground">{t("wiki.style.saved")}</h3>
          <ul className="flex flex-col gap-1">
            {saved.map((named, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: two palettes may share a name; the list only grows at its end.
              <li key={`${named.name}-${index}`} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onChange({ palette: named.palette })}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1 text-left text-sm outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <Swatches palette={named.palette} />
                  <span className="truncate">{named.name}</span>
                </button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t("wiki.style.deletePalette", { name: named.name })}
                  onClick={() =>
                    onChange({ savedPalettes: saved.filter((_, other) => other !== index) })
                  }
                >
                  <X />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** The colours one by one, a contrast warning, and « Enregistrer la palette ». */
function Colors({ theme, onChange }: TabProps) {
  const { t } = useTranslation();
  const shown = resolveTheme(theme).palette;
  const [draft, setDraft] = useState<WikiPalette>(shown);
  const [name, setName] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const nameId = useId();
  const key = COLORS.map((color) => shown[color]).join();
  // biome-ignore lint/correctness/useExhaustiveDependencies: the key stands for the colours shown
  useEffect(() => setDraft(shown), [key]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const change = (color: (typeof COLORS)[number], value: string) => {
    const next = { ...draft, [color]: value };
    setDraft(next);
    clearTimeout(timer.current);
    if (/^#[0-9a-fA-F]{6}$/.test(value)) {
      timer.current = setTimeout(
        () => onChange({ palette: { ...next, [color]: value.toLowerCase() } }),
        SAVE_DELAY_MS,
      );
    }
  };
  const weak = (["text", "muted"] as const).filter(
    (color) => contrast(draft[color], draft.background) < MIN_TEXT_CONTRAST,
  );
  const saved = theme.savedPalettes ?? [];
  const savePalette = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed === "") return;
    onChange({ palette: draft, savedPalettes: [...saved, { name: trimmed, palette: draft }] });
    setName("");
  };

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {COLORS.map((color) => (
          <ColorRow
            key={color}
            label={t(`wiki.style.color.${color}`)}
            value={draft[color]}
            onChange={(value) => change(color, value)}
          />
        ))}
      </ul>
      {weak.length > 0 && (
        <p role="status" className="text-xs text-destructive">
          {t("wiki.style.lowContrast")}
        </p>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        disabled={!theme.palette}
        onClick={() => onChange({ palette: null })}
      >
        <RotateCcw />
        {t("wiki.style.resetColors")}
      </Button>
      <form onSubmit={savePalette} className="flex gap-2">
        <label htmlFor={nameId} className="sr-only">
          {t("wiki.style.paletteName")}
        </label>
        <Input
          id={nameId}
          value={name}
          maxLength={100}
          placeholder={t("wiki.style.paletteName")}
          onChange={(event) => setName(event.target.value)}
        />
        <Button
          type="submit"
          variant="secondary"
          disabled={name.trim() === "" || saved.length >= MAX_SAVED_PALETTES}
        >
          <Save />
          {t("wiki.style.savePalette")}
        </Button>
      </form>
    </div>
  );
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <li className="grid grid-cols-[1fr_auto_6rem] items-center gap-2">
      <label htmlFor={id} className="text-sm">
        {label}
      </label>
      <input
        type="color"
        aria-label={t("wiki.style.pickColor", { name: label })}
        value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"}
        onChange={(event) => onChange(event.target.value)}
        className="h-7 w-10 cursor-pointer rounded border border-border bg-transparent"
      />
      <Input
        id={id}
        value={value}
        maxLength={7}
        spellCheck={false}
        aria-invalid={!/^#[0-9a-fA-F]{6}$/.test(value)}
        onChange={(event) => onChange(event.target.value)}
        className="h-7 font-mono text-xs"
      />
    </li>
  );
}

/** The fonts of the titles and of the text. */
function Fonts({ theme, onChange }: TabProps) {
  const { t } = useTranslation();
  const { headingFont, bodyFont } = resolveTheme(theme);
  return (
    <div className="flex flex-col gap-3">
      <FontSelect
        label={t("wiki.style.headingFont")}
        value={headingFont}
        onChange={(key) => onChange({ headingFont: key })}
      />
      <FontSelect
        label={t("wiki.style.bodyFont")}
        value={bodyFont}
        onChange={(key) => onChange({ bodyFont: key })}
      />
    </div>
  );
}

function FontSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: WikiFontKey;
  onChange: (key: WikiFontKey) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm">
        {label}
      </label>
      <Select value={value} onValueChange={(key) => onChange(key as WikiFontKey)}>
        <SelectTrigger id={id} className="w-full" style={{ fontFamily: WIKI_FONTS[value] }}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FONT_KEYS.map((key) => (
            <SelectItem key={key} value={key} style={{ fontFamily: WIKI_FONTS[key] }}>
              {FONT_NAMES[key]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
