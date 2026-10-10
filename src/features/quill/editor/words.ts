/**
 * Words of a text, counted as the Rust side does (`split_whitespace`): the
 * live count while typing matches the saved one.
 */
export function countWords(text: string): number {
  const words = text.trim().split(/\s+/);
  return words[0] === "" ? 0 : words.length;
}
