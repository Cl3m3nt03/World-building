#!/usr/bin/env node
// Builds THIRD-PARTY-NOTICES.txt, the licences of everything Atlasaga ships
// (docs/outils/licences.md):
//   - Rust crates, from cargo-about (src-tauri/about.toml);
//   - JavaScript production packages, from `pnpm licenses list --prod`;
//   - bundled assets no package manager lists (licenses/bundled.json);
//   - the NOTICE files of those crates and packages (Apache-2.0 §4(d)).
// Fails when a crate or a package is under a licence that is not in the
// `accepted` list of about.toml, so a copyleft or unknown licence never ships
// unseen. Output: src-tauri/notices/THIRD-PARTY-NOTICES.txt (not committed),
// shipped by tauri.conf.json (bundle.resources) and shown in Settings › About.
//
// Usage: node scripts/third-party-notices.mjs [--out <file>]

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const outArg = process.argv.indexOf("--out");
const out =
  outArg > 0
    ? path.resolve(process.argv[outArg + 1])
    : path.join(root, "src-tauri", "notices", "THIRD-PARTY-NOTICES.txt");

const RULE = "=".repeat(80);
const THIN = "-".repeat(80);

// Licences whose packages are named with a link to their source (MPL-2.0 §3.2).
const SOURCE_LINKED = new Set(["MPL-2.0"]);

// Packages whose manifest declares no usable licence, checked by hand.
const JS_OVERRIDES = {
  // package.json has no "license" field; its `license` file is MIT.
  khroma: "MIT",
};

function fail(message) {
  console.error(`third-party-notices: ${message}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 512 * 1024 * 1024,
    stdio: ["ignore", "pipe", "inherit"],
    ...options,
  });
  if (result.error) fail(`${command} could not start: ${result.error.message}`);
  if (result.status !== 0) fail(`${command} ${args.join(" ")} failed (exit ${result.status})`);
  return result.stdout;
}

const normalize = (text) =>
  text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/^\n+|\n+$/g, "");

// --- Accepted licences: the single list lives in about.toml. ---------------

const aboutToml = readFileSync(path.join(root, "src-tauri", "about.toml"), "utf8");
const acceptedBlock = aboutToml.match(/^accepted\s*=\s*\[([\s\S]*?)\]/m);
if (!acceptedBlock) fail("no `accepted` list in src-tauri/about.toml");
const ACCEPTED = new Set([...acceptedBlock[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]));

/** Whether an SPDX expression is satisfied by the accepted licences. */
function satisfies(expression, accepted = ACCEPTED) {
  const tokens = expression.replace(/[()]/g, " $& ").trim().split(/\s+/);
  let at = 0;
  const atom = () => {
    const token = tokens[at++];
    if (token === "(") {
      const value = or();
      at++; // ")"
      return value;
    }
    let id = token;
    if (tokens[at] === "WITH") {
      id = `${id} WITH ${tokens[at + 1]}`;
      at += 2;
      return accepted.has(id) || accepted.has(token);
    }
    return accepted.has(id);
  };
  const and = () => {
    let value = atom();
    while (tokens[at] === "AND") {
      at++;
      value = atom() && value;
    }
    return value;
  };
  const or = () => {
    let value = and();
    while (tokens[at] === "OR") {
      at++;
      value = and() || value;
    }
    return value;
  };
  return or();
}

const noticeFiles = (dir) =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((file) => /^notice(\.(txt|md))?$/i.test(file))
        .map((file) => normalize(readFileSync(path.join(dir, file), "utf8")))
    : [];

/** Sections keyed by licence + text, so identical texts are written once. */
const sections = new Map();
function add(licence, group, item, text, source) {
  const key = `${licence}\n${normalize(text)}`;
  let section = sections.get(key);
  if (!section) {
    section = { licence, text: normalize(text), groups: new Map(), sources: [] };
    sections.set(key, section);
  }
  if (!section.groups.has(group)) section.groups.set(group, []);
  section.groups.get(group).push(item);
  if (source && SOURCE_LINKED.has(licence)) section.sources.push(`${item}: ${source}`);
}

// Components per licence (a crate under "A AND B" counts for both).
const counts = { rust: {}, js: {}, assets: {} };
const components = { rust: new Set(), js: new Set(), assets: new Set() };
const bump = (kind, licence, item) => {
  counts[kind][licence] = (counts[kind][licence] ?? 0) + 1;
  components[kind].add(item);
};

// --- Rust: cargo-about. -----------------------------------------------------

// Through a file: cargo-about refuses to write to a pipe under PowerShell.
const aboutJson = path.join(mkdtempSync(path.join(tmpdir(), "notices-")), "about.json");
run("cargo", [
  "about",
  "generate",
  "--format",
  "json",
  "--fail",
  "--locked",
  "--config",
  "src-tauri/about.toml",
  "--manifest-path",
  "src-tauri/Cargo.toml",
  "--output-file",
  aboutJson,
]);
const about = JSON.parse(readFileSync(aboutJson, "utf8"));
rmSync(path.dirname(aboutJson), { recursive: true, force: true });
const rustNotices = new Map();
for (const licence of about.licenses) {
  for (const { crate } of licence.used_by) {
    const item = `${crate.name} ${crate.version}`;
    const source = crate.repository ?? `https://crates.io/crates/${crate.name}/${crate.version}`;
    add(licence.id, "Rust crates", item, licence.text, source);
    bump("rust", licence.id, item);
    for (const notice of noticeFiles(path.dirname(crate.manifest_path))) {
      if (!rustNotices.has(item)) rustNotices.set(item, notice);
    }
  }
}
for (const [item, notice] of rustNotices) add("NOTICE", "Rust crates", item, notice);

// --- JavaScript: production packages. ---------------------------------------

const MIT_TEMPLATE = (holder) => `MIT License

Copyright (c) ${holder}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

const pnpmLicenses = JSON.parse(
  // `shell` for pnpm.cmd on Windows; the arguments are fixed.
  run("pnpm", ["licenses", "list", "--prod", "--json"], { shell: true }),
);
const refused = [];
for (const [declared, packages] of Object.entries(pnpmLicenses)) {
  for (const pkg of packages) {
    const licence = JS_OVERRIDES[pkg.name] ?? declared.replace(/^\((.*)\)$/, "$1");
    pkg.versions.forEach((version, index) => {
      const item = `${pkg.name} ${version}`;
      if (!satisfies(licence)) {
        refused.push(`${item} (${declared})`);
        return;
      }
      const dir = pkg.paths[index] ?? pkg.paths[0];
      const files = readdirSync(dir).filter((file) =>
        /^(licen[cs]e|copying)([-._].*)?$/i.test(file),
      );
      let text = files
        .map((file) => normalize(readFileSync(path.join(dir, file), "utf8")))
        .join("\n\n");
      if (!text) {
        // No licence file in the package: the standard text of its licence.
        if (licence !== "MIT") fail(`${item}: no licence file for ${licence}`);
        text = MIT_TEMPLATE(pkg.author || `the ${pkg.name} authors`);
      }
      add(licence, "JavaScript packages", item, text, pkg.homepage);
      bump("js", licence, item);
      for (const notice of noticeFiles(dir)) add("NOTICE", "JavaScript packages", item, notice);
    });
  }
}
if (refused.length) {
  fail(
    `JavaScript packages under a licence that is not accepted (src-tauri/about.toml):\n  ${refused.join("\n  ")}`,
  );
}

// --- Bundled assets. --------------------------------------------------------

const bundled = JSON.parse(readFileSync(path.join(root, "licenses", "bundled.json"), "utf8"));
for (const asset of bundled.assets) {
  const file = path.join(root, "licenses", asset.file);
  if (!existsSync(file)) fail(`missing licence file licenses/${asset.file}`);
  add(asset.licence, "Bundled assets", asset.name, readFileSync(file, "utf8"));
  bump("assets", asset.licence, asset.name);
}

// --- Output. ----------------------------------------------------------------

const ordered = [...sections.values()].sort(
  (a, b) =>
    (a.licence === "NOTICE") - (b.licence === "NOTICE") ||
    a.licence.localeCompare(b.licence) ||
    [...a.groups.values()][0][0].localeCompare([...b.groups.values()][0][0]),
);

const lines = [
  "Atlasaga - third-party notices",
  "",
  "Atlasaga includes the third-party software and assets listed below. Each",
  "section names a licence, the components it applies to, and the licence",
  "text, with the copyright notices of those components.",
  "",
  `Rust crates: ${components.rust.size}. JavaScript packages: ${components.js.size}. Bundled assets: ${components.assets.size}.`,
];
for (const section of ordered) {
  lines.push("", RULE, `§ ${section.licence}`);
  for (const [group, items] of section.groups) {
    lines.push(`${group}: ${[...new Set(items)].join(", ")}`);
  }
  for (const source of section.sources) lines.push(`Source code: ${source}`);
  lines.push(THIN, section.text);
}
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, `${lines.join("\n")}\n`);

const summary = (table) =>
  Object.entries(table)
    .sort((a, b) => b[1] - a[1])
    .map(([licence, n]) => `${licence} ${n}`)
    .join(", ");
console.log(`third-party-notices: ${path.relative(root, out)} (${ordered.length} sections)`);
console.log(`  Rust crates (${components.rust.size}): ${summary(counts.rust)}`);
console.log(`  JavaScript packages (${components.js.size}): ${summary(counts.js)}`);
console.log(`  Bundled assets (${components.assets.size}): ${summary(counts.assets)}`);
