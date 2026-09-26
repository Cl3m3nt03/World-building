import type { TranslationKey } from "@/i18n";
import type { Genre } from "@/lib/bindings";

/** World genres, in display order, with their translation key. */
export const GENRES: { value: Genre; label: TranslationKey }[] = [
  { value: "fantasy", label: "genre.fantasy" },
  { value: "scienceFiction", label: "genre.scienceFiction" },
  { value: "romance", label: "genre.romance" },
  { value: "cyberpunk", label: "genre.cyberpunk" },
  { value: "contemporary", label: "genre.contemporary" },
  { value: "other", label: "genre.other" },
];

export const DEFAULT_GENRE: Genre = "fantasy";

export function isGenre(value: string): value is Genre {
  return GENRES.some((genre) => genre.value === value);
}

export function genreLabel(genre: Genre): TranslationKey {
  return GENRES.find((item) => item.value === genre)?.label ?? "genre.other";
}
