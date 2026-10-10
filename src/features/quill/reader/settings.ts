import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { WIKI_FONTS, type WikiFontKey } from "@/features/wiki";
import { commands, type PageTheme, type ReaderSettings, type TextSize } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";
import { lightText } from "../cover/coverArt";
import { quillKeys } from "../hooks/useQuill";

/** The settings of a story never set (the Rust side gives the same). */
export const DEFAULT_READER: ReaderSettings = {
  theme: "light",
  mode: "scroll",
  background: null,
  font: "garamond",
  textSize: "medium",
  chapterLayout: "imageAbove",
  wordsPerMinute: 200,
};

/**
 * The colours of a page, for each theme. They belong to the book (what a
 * reader sees, as in the exports), not to the app's interface: like the
 * wiki's palettes, they are data rather than tokens.
 */
export const PAGE_THEMES: Record<PageTheme, { page: string; text: string; muted: string }> = {
  light: { page: "#fbf8f1", text: "#221d17", muted: "#6f665a" },
  sepia: { page: "#f2e7d0", text: "#3a2d1f", muted: "#7a6650" },
  dark: { page: "#17171c", text: "#e7e2d8", muted: "#a39d92" },
};

/** Backgrounds offered for the page (the theme's own page comes first). */
export const PAGE_BACKGROUNDS = [
  "#ffffff",
  "#f6f1e7",
  "#e9e2d0",
  "#e6ece4",
  "#e5ebf2",
  "#efe6ee",
  "#2a2a30",
  "#1b2230",
  "#262019",
] as const;

/** Size of the text, in pixels, for each setting. */
export const TEXT_SIZES: Record<TextSize, number> = { small: 16, medium: 18, large: 21 };

/** The colours of a page: its theme's, or its background with a text that reads on it. */
export function pageColors(settings: ReaderSettings) {
  const theme = PAGE_THEMES[settings.theme];
  if (!settings.background) return theme;
  const dark = lightText(settings.background);
  const base = dark ? PAGE_THEMES.dark : PAGE_THEMES.light;
  return { page: settings.background, text: base.text, muted: base.muted };
}

/** The CSS font of a font key (the wiki's free fonts), or the default one. */
export function readerFont(key: string): string {
  return key in WIKI_FONTS ? WIKI_FONTS[key as WikiFontKey] : WIKI_FONTS.garamond;
}

const settingsKey = (storyId: string) => [...quillKeys.all(), "reader", storyId] as const;

/** A story's reading settings, changed at once on screen and then kept. */
export function useReaderSettings(storyId: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: settingsKey(storyId),
    queryFn: () => unwrap(commands.readerSettings(storyId)),
  });
  const save = useMutation({
    mutationFn: (settings: ReaderSettings) =>
      unwrap(commands.saveReaderSettings(storyId, settings)),
    onMutate: (settings) => {
      queryClient.setQueryData(settingsKey(storyId), settings);
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: settingsKey(storyId) });
    },
  });
  const settings = query.data ?? DEFAULT_READER;
  return {
    settings,
    loaded: query.data !== undefined,
    error: save.error ?? query.error,
    change: (patch: Partial<ReaderSettings>) => save.mutate({ ...settings, ...patch }),
  };
}
