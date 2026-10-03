/**
 * The exported site's stylesheet and script (ADR 0008). The colours and
 * fonts come from the wiki's theme, as variables on `:root` (see `rootCss`);
 * the script only searches (in `search.js`, read without `fetch`, so it works
 * from `file://`) and turns the home page's slideshow.
 */

/** `:root` of the site: the theme's variables, and the card-type colours of its light or dark set. */
export function rootCss(variables: Record<string, string>): string {
  const lines = Object.entries(variables).map(([name, value]) => `  ${name}: ${value};`);
  return `:root {\n${lines.join("\n")}\n}\n`;
}

export const SITE_CSS = `
*, *::before, *::after { box-sizing: border-box; }
html { color-scheme: var(--scheme); }
body {
  margin: 0;
  background: var(--wiki-background);
  color: var(--wiki-text);
  font-family: var(--wiki-body-font);
  line-height: 1.6;
}
h1, h2, h3 { font-family: var(--wiki-heading-font); line-height: 1.2; }
h1 { color: var(--wiki-accent); font-size: 2.4rem; margin: 0 0 0.25rem; }
h2 { font-size: 1.25rem; }
a { color: var(--wiki-accent); }
img { max-width: 100%; display: block; }
.site-nav {
  position: sticky; top: 0; z-index: 10;
  display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;
  padding: 0.6rem 1.25rem;
  background: var(--wiki-background);
  border-bottom: 1px solid color-mix(in srgb, var(--wiki-text) 12%, transparent);
}
.site-title { font-family: var(--wiki-heading-font); font-weight: 700; font-size: 1.1rem; text-decoration: none; }
.site-pages { position: relative; }
.site-pages summary {
  cursor: pointer; list-style: none; padding: 0.2rem 0.7rem; border-radius: 0.4rem;
  border: 1px solid color-mix(in srgb, var(--wiki-text) 15%, transparent);
  background: var(--wiki-surface); font-size: 0.9rem;
}
.site-pages summary::-webkit-details-marker { display: none; }
.site-pages-list {
  position: absolute; top: calc(100% + 0.4rem); left: 0; width: 18rem; max-height: 70vh; overflow-y: auto;
  padding: 0.5rem 0.75rem; border-radius: 0.5rem; background: var(--wiki-surface);
  border: 1px solid color-mix(in srgb, var(--wiki-text) 12%, transparent);
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.15);
}
.site-pages-list h2 { font-size: 0.75rem; color: var(--wiki-muted); margin: 0.6rem 0 0.2rem; font-family: var(--wiki-body-font); }
.site-pages-list ul, .cited ul, .site-results { list-style: none; margin: 0; padding: 0; }
.site-pages-list a { display: block; padding: 0.15rem 0; text-decoration: none; color: var(--wiki-text); }
.site-pages-list a:hover { color: var(--wiki-accent); }
.site-search { position: relative; margin-left: auto; width: min(18rem, 100%); }
.home .site-search { margin: 1rem 0; width: 100%; }
.site-search input {
  width: 100%; padding: 0.4rem 0.7rem; border-radius: 0.4rem; font: inherit;
  border: 1px solid color-mix(in srgb, var(--wiki-text) 15%, transparent);
  background: var(--wiki-surface); color: var(--wiki-text);
}
.site-results, .site-noresult {
  position: absolute; top: calc(100% + 0.3rem); left: 0; right: 0; z-index: 20; margin: 0;
  padding: 0.3rem; border-radius: 0.5rem; background: var(--wiki-surface);
  border: 1px solid color-mix(in srgb, var(--wiki-text) 12%, transparent);
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.15);
}
.site-noresult { padding: 0.6rem; color: var(--wiki-muted); font-size: 0.9rem; }
.site-results a { display: block; padding: 0.3rem 0.5rem; border-radius: 0.3rem; text-decoration: none; color: var(--wiki-text); }
.site-results a:hover, .site-results a:focus { background: var(--wiki-background); }
.site-results small { display: block; color: var(--wiki-muted); }
.home { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); gap: 1.5rem; padding: 1.25rem; }
.hero { position: sticky; top: 4rem; height: calc(100vh - 6rem); border-radius: 0.6rem; overflow: hidden; background: var(--wiki-surface); }
.hero-slide { position: absolute; inset: 0; }
.hero-slide[hidden] { display: none; }
.hero-slide img { width: 100%; height: 100%; object-fit: cover; }
.hero-slide span, .tile span {
  position: absolute; left: 0; right: 0; bottom: 0; padding: 2rem 1rem 0.8rem;
  background: linear-gradient(to top, rgb(0 0 0 / 0.7), transparent); color: white;
  font-family: var(--wiki-heading-font); font-weight: 700; font-size: 1.3rem;
}
.banner { width: 100%; aspect-ratio: 4 / 1; object-fit: cover; border-radius: 0.6rem; margin-bottom: 1rem; }
.description p { margin: 0 0 0.75rem; }
.tiles { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr)); gap: 0.75rem; }
.tile { position: relative; display: block; aspect-ratio: 4 / 5; border-radius: 0.6rem; overflow: hidden; background: var(--wiki-surface); text-decoration: none; color: var(--wiki-text); }
.tile img { width: 100%; height: 100%; object-fit: cover; }
.tile span { font-size: 0.95rem; font-family: var(--wiki-body-font); }
.tile:not(:has(img)) span { background: none; color: var(--wiki-text); }
.page { max-width: 72rem; margin: 0 auto; padding: 1.5rem; }
.card-page { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 3fr); gap: 2rem; align-items: start; }
.card-page:not(:has(.card-image)) { grid-template-columns: minmax(0, 1fr); }
.card-image { width: 100%; border-radius: 0.75rem; position: sticky; top: 4.5rem; }
.card-type { margin: 0 0 1rem; color: var(--wiki-muted); }
.card-type::before { content: ""; display: inline-block; width: 0.6rem; height: 0.6rem; border-radius: 50%; background: var(--type); margin-right: 0.4rem; }
.properties {
  margin: 0 0 1.5rem; padding: 1rem; border-radius: 0.6rem; background: var(--wiki-surface);
  border: 1px solid color-mix(in srgb, var(--wiki-text) 12%, transparent);
}
.properties div { display: grid; grid-template-columns: 10rem 1fr; gap: 0.75rem; padding: 0.2rem 0; }
.properties dt { color: var(--wiki-muted); }
.properties dd { margin: 0; }
.block-row { display: grid; gap: 1.25rem; margin-bottom: 1rem; }
.prose p { margin: 0 0 0.75rem; }
.prose blockquote { margin: 0 0 0.75rem; padding-left: 1rem; border-left: 3px solid var(--wiki-accent); color: var(--wiki-muted); }
.prose code, .prose pre { font-family: ui-monospace, monospace; background: var(--wiki-surface); border-radius: 0.3rem; padding: 0.1rem 0.3rem; }
.prose pre { padding: 0.75rem; overflow-x: auto; }
.mention { text-decoration: none; padding: 0 0.2rem; border-radius: 0.25rem; background: color-mix(in srgb, var(--wiki-accent) 12%, transparent); }
.mention:hover { text-decoration: underline; }
.mention-dead { color: var(--wiki-muted); text-decoration: line-through; }
.gallery { display: flex; gap: 0.75rem; overflow-x: auto; }
.gallery figure { margin: 0; flex: 0 0 auto; max-width: 100%; }
.gallery img { max-height: 22rem; border-radius: 0.5rem; }
figcaption { color: var(--wiki-muted); font-size: 0.85rem; margin-top: 0.3rem; }
.map-block { margin: 0; }
.stats { padding: 1rem; border-radius: 0.6rem; background: var(--wiki-surface); border: 1px solid color-mix(in srgb, var(--wiki-text) 12%, transparent); }
.abilities { display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.5rem; text-align: center; margin: 0 0 0.75rem; }
.abilities dt { font-weight: 700; color: var(--wiki-accent); }
.abilities dd, .stats-lines dd { margin: 0; }
.stats-lines div { display: flex; gap: 0.5rem; }
.stats-lines dt { font-weight: 700; }
.stats h3 { margin: 0.75rem 0 0.25rem; }
.map { position: relative; width: 100%; container-type: inline-size; border-radius: 0.6rem; overflow: hidden; background: var(--wiki-surface); }
.map > img, .map > svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.map > img { object-fit: fill; }
.map-text, .map-label, .pin { position: absolute; transform: translate(-50%, -50%); }
.map-text { font-family: var(--wiki-heading-font); color: white; text-shadow: 0 1px 3px rgb(0 0 0 / 0.8); white-space: nowrap; }
.map-label { font-size: 0.85rem; color: white; text-shadow: 0 1px 3px rgb(0 0 0 / 0.8); }
.pin { display: flex; flex-direction: column; align-items: center; gap: 0.15rem; text-decoration: none; }
.pin-disc { width: 2rem; height: 2rem; border-radius: 50%; border: 2px solid var(--wiki-surface); overflow: hidden; box-shadow: 0 2px 6px rgb(0 0 0 / 0.3); }
.pin-disc img { width: 100%; height: 100%; object-fit: cover; }
.pin-label { font-size: 0.75rem; padding: 0 0.3rem; border-radius: 0.2rem; background: color-mix(in srgb, var(--wiki-surface) 85%, transparent); color: var(--wiki-text); white-space: nowrap; }
a.pin:hover .pin-label { color: var(--wiki-accent); }
.map-page .map { margin: 1rem 0; }
.cited { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid color-mix(in srgb, var(--wiki-text) 12%, transparent); }
.cited ul { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.cited a { display: inline-block; padding: 0.2rem 0.75rem; border-radius: 999px; background: var(--wiki-surface); text-decoration: none; border: 1px solid color-mix(in srgb, var(--wiki-text) 12%, transparent); }
.site-footer { text-align: center; color: var(--wiki-muted); font-size: 0.8rem; padding: 2rem 1rem; }
:focus-visible { outline: 3px solid color-mix(in srgb, var(--wiki-accent) 60%, transparent); outline-offset: 2px; }
@media (max-width: 760px) {
  .home, .card-page { grid-template-columns: minmax(0, 1fr); }
  .hero { position: relative; top: 0; height: 16rem; }
  .card-image { position: static; }
  .block-row { grid-template-columns: minmax(0, 1fr) !important; }
  .properties div { grid-template-columns: 1fr; gap: 0; }
}
@media (prefers-reduced-motion: no-preference) {
  .tile img { transition: transform 0.3s; }
  .tile:hover img { transform: scale(1.05); }
}
`;

/** `site.js`: the search (from `window.BZ_SEARCH`) and the slideshow. */
export const SITE_JS = `(function () {
  "use strict";
  var base = document.body.getAttribute("data-base") || "";
  var pages = (window.BZ_SEARCH && window.BZ_SEARCH.pages) || [];
  function fold(text) {
    return text.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase();
  }
  function rank(page, query) {
    if (fold(page.t).indexOf(query) >= 0) return 0;
    if (page.a.some(function (alias) { return fold(alias).indexOf(query) >= 0; })) return 1;
    if (fold(page.x).indexOf(query) >= 0) return 2;
    return -1;
  }
  function excerpt(page, query) {
    var at = fold(page.x).indexOf(query);
    if (at < 0) return "";
    var start = Math.max(0, at - 40);
    return (start > 0 ? "…" : "") + page.x.slice(start, at + query.length + 60) + "…";
  }
  document.querySelectorAll(".site-search").forEach(function (box) {
    var input = box.querySelector("input");
    var list = box.querySelector(".site-results");
    var none = box.querySelector(".site-noresult");
    function show() {
      var query = fold(input.value.trim());
      list.innerHTML = "";
      if (!query) { list.hidden = true; none.hidden = true; return; }
      var found = pages
        .map(function (page) { return { page: page, rank: rank(page, query) }; })
        .filter(function (hit) { return hit.rank >= 0; })
        .sort(function (a, b) { return a.rank - b.rank || a.page.t.localeCompare(b.page.t); })
        .slice(0, 8);
      found.forEach(function (hit) {
        var item = document.createElement("li");
        var link = document.createElement("a");
        link.href = base + hit.page.u;
        link.textContent = hit.page.t;
        if (hit.rank === 2) {
          var text = document.createElement("small");
          text.textContent = excerpt(hit.page, query);
          link.appendChild(text);
        }
        item.appendChild(link);
        list.appendChild(item);
      });
      list.hidden = found.length === 0;
      none.hidden = found.length > 0;
    }
    input.addEventListener("input", show);
    input.addEventListener("keydown", function (event) {
      if (event.key === "Escape") { input.value = ""; show(); }
    });
  });
  var slides = document.querySelectorAll(".hero-slide");
  var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (slides.length > 1 && !still) {
    var current = 0;
    setInterval(function () {
      slides[current].hidden = true;
      current = (current + 1) % slides.length;
      slides[current].hidden = false;
    }, 7000);
  }
})();
`;
