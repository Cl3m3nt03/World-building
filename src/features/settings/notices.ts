/**
 * Reads THIRD-PARTY-NOTICES.txt (written by scripts/third-party-notices.mjs):
 * an introduction, then sections that each open with a rule of `=`, a
 * `§ <licence>` line, the components it applies to (`<group>: a, b`), a rule
 * of `-` and the licence text.
 */

export type NoticeGroup = { label: string; items: string[] };

export type NoticeSection = {
  /** Position in the file, a stable key. */
  id: number;
  licence: string;
  groups: NoticeGroup[];
  /** Where to get the source of the components (MPL-2.0). */
  sources: string[];
  text: string;
};

export type Notices = { intro: string; sections: NoticeSection[] };

const RULE = "=".repeat(80);
const THIN = "-".repeat(80);
const SOURCE = "Source code: ";

export function parseNotices(raw: string): Notices {
  const [intro = "", ...chunks] = raw.replace(/\r\n?/g, "\n").split(`\n${RULE}\n`);
  const sections: NoticeSection[] = [];
  for (const chunk of chunks) {
    const split = chunk.indexOf(`\n${THIN}\n`);
    if (!chunk.startsWith("§ ") || split < 0) continue;
    const [title = "", ...meta] = chunk.slice(0, split).split("\n");
    const groups: NoticeGroup[] = [];
    const sources: string[] = [];
    for (const line of meta) {
      if (line.startsWith(SOURCE)) {
        sources.push(line.slice(SOURCE.length));
        continue;
      }
      const colon = line.indexOf(": ");
      if (colon < 0) continue;
      groups.push({ label: line.slice(0, colon), items: line.slice(colon + 2).split(", ") });
    }
    sections.push({
      id: sections.length,
      licence: title.slice(2).trim(),
      groups,
      sources,
      text: chunk.slice(split + THIN.length + 2).trimEnd(),
    });
  }
  return { intro: intro.trim(), sections };
}

/** Sections whose licence or one of whose components contains the query. */
export function filterNotices(sections: NoticeSection[], query: string): NoticeSection[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return sections;
  return sections.filter(
    (section) =>
      section.licence.toLowerCase().includes(needle) ||
      section.groups.some((group) =>
        group.items.some((item) => item.toLowerCase().includes(needle)),
      ),
  );
}
