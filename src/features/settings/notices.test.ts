import { expect, test } from "vitest";
import { filterNotices, parseNotices } from "./notices";

const RULE = "=".repeat(80);
const THIN = "-".repeat(80);
const FILE = [
  "Atlasaga - third-party notices",
  "",
  "Intro.",
  "",
  RULE,
  "§ MIT",
  "Rust crates: serde 1.0.0, tokio 1.53.1",
  "JavaScript packages: react 19.2.0",
  THIN,
  "MIT License",
  "",
  "Copyright (c) Someone",
  "",
  RULE,
  "§ MPL-2.0",
  "Rust crates: epub-builder 0.8.3",
  "Source code: epub-builder 0.8.3: https://github.com/lise-henry/epub-builder/",
  THIN,
  "Mozilla Public License Version 2.0",
  "",
].join("\r\n");

test("reads the sections, their components and their texts", () => {
  const notices = parseNotices(FILE);
  expect(notices.intro).toBe("Atlasaga - third-party notices\n\nIntro.");
  expect(notices.sections).toHaveLength(2);
  const [mit, mpl] = notices.sections;
  expect(mit?.licence).toBe("MIT");
  expect(mit?.groups).toEqual([
    { label: "Rust crates", items: ["serde 1.0.0", "tokio 1.53.1"] },
    { label: "JavaScript packages", items: ["react 19.2.0"] },
  ]);
  expect(mit?.text).toBe("MIT License\n\nCopyright (c) Someone");
  expect(mpl?.sources).toEqual(["epub-builder 0.8.3: https://github.com/lise-henry/epub-builder/"]);
  expect(mpl?.groups).toHaveLength(1);
});

test("a file without sections (a development build) keeps its introduction", () => {
  const notices = parseNotices(
    "Atlasaga - third-party notices (not generated)\n\nRun pnpm notices.\n",
  );
  expect(notices.sections).toEqual([]);
  expect(notices.intro).toContain("not generated");
});

test("filters by licence or component, ignoring case", () => {
  const { sections } = parseNotices(FILE);
  expect(filterNotices(sections, "mpl").map((s) => s.licence)).toEqual(["MPL-2.0"]);
  expect(filterNotices(sections, "TOKIO").map((s) => s.licence)).toEqual(["MIT"]);
  expect(filterNotices(sections, "  ")).toHaveLength(2);
  expect(filterNotices(sections, "nothing")).toEqual([]);
});
