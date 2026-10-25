import type { TranslationKey } from "@/i18n";
import type { Genre, Tone } from "@/lib/bindings";

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

/** Most tones a world can have (ADR 0013, same bound as the Rust side). */
export const MAX_TONES = 6;

/** World tones beside the genre (ADR 0013), in display order, with their translation key. */
export const TONES: { value: Tone; label: TranslationKey }[] = [
  { value: "epic", label: "tone.epic" },
  { value: "grimdark", label: "tone.grimdark" },
  { value: "darkFantasy", label: "tone.darkFantasy" },
  { value: "mythology", label: "tone.mythology" },
  { value: "historical", label: "tone.historical" },
  { value: "alternateHistory", label: "tone.alternateHistory" },
  { value: "dystopian", label: "tone.dystopian" },
  { value: "postApocalyptic", label: "tone.postApocalyptic" },
  { value: "steampunk", label: "tone.steampunk" },
  { value: "solarpunk", label: "tone.solarpunk" },
  { value: "gaslamp", label: "tone.gaslamp" },
  { value: "horror", label: "tone.horror" },
  { value: "mystery", label: "tone.mystery" },
  { value: "survival", label: "tone.survival" },
  { value: "western", label: "tone.western" },
  { value: "cozy", label: "tone.cozy" },
  { value: "comedy", label: "tone.comedy" },
];
