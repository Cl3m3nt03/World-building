import { Link, useParams } from "@tanstack/react-router";
import { BookOpen, Pause, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AssetImage } from "@/features/media";
import type { WikiPage } from "@/lib/bindings";
import { cn } from "@/lib/utils";
import { pageRoute } from "../links";
import { WIKI_FOCUS } from "./styles";

/** Time each featured page stays in the large image. */
export const HERO_INTERVAL_MS = 7000;

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
}

/**
 * The large image on the left of the wiki's home page: it goes from one
 * featured page with an image to the next, with its name. It stops while
 * the pointer or the focus is on it, when paused, and does not start by
 * itself when the system asks for less motion.
 */
export function WikiHero({ pages }: { pages: WikiPage[] }) {
  const { t } = useTranslation();
  const { worldId } = useParams({ from: "/world/$worldId" });
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(prefersReducedMotion);
  const [held, setHeld] = useState(false);
  const count = pages.length;
  const current = pages[Math.min(index, count - 1)];
  const playing = !paused && !held && count > 1;

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setIndex((at) => (at + 1) % count), HERO_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [playing, count]);

  if (!current) {
    return (
      <div className="flex h-full min-h-48 items-center justify-center rounded-lg bg-wiki-surface text-wiki-muted">
        <BookOpen aria-hidden className="size-12 opacity-50" />
      </div>
    );
  }

  return (
    <section
      aria-roledescription={t("wiki.hero.carousel")}
      aria-label={t("wiki.hero.label")}
      className="relative h-full min-h-48 overflow-hidden rounded-lg bg-wiki-surface"
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHeld(false);
      }}
    >
      {pages.map((page) => (
        <AssetImage
          key={page.id}
          // Every page with an image has one here.
          assetId={page.imageAssetId ?? ""}
          alt=""
          aria-hidden
          draggable={false}
          className={cn(
            "absolute inset-0 size-full object-cover transition-opacity duration-700 motion-reduce:transition-none",
            page.id === current.id ? "opacity-100" : "opacity-0",
          )}
        />
      ))}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent"
      />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
        <div className="flex min-w-0 flex-col gap-2" aria-live={playing ? "off" : "polite"}>
          <Link
            {...pageRoute(worldId, current)}
            className={cn(
              "truncate rounded font-wiki-heading text-xl font-bold text-white drop-shadow",
              WIKI_FOCUS,
            )}
          >
            {current.title}
          </Link>
          {count > 1 && (
            <div className="flex gap-1.5">
              {pages.map((page, at) => (
                <button
                  key={page.id}
                  type="button"
                  aria-label={t("wiki.hero.show", { name: page.title })}
                  aria-current={page.id === current.id ? "true" : undefined}
                  onClick={() => setIndex(at)}
                  className={cn(
                    "h-1.5 w-4 rounded-full bg-white/50 transition hover:bg-white/80 aria-[current=true]:w-6 aria-[current=true]:bg-white",
                    WIKI_FOCUS,
                  )}
                />
              ))}
            </div>
          )}
        </div>
        {count > 1 && (
          <button
            type="button"
            aria-label={t(paused ? "wiki.hero.play" : "wiki.hero.pause")}
            onClick={() => setPaused(!paused)}
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/60 [&_svg]:size-4",
              WIKI_FOCUS,
            )}
          >
            {paused ? <Play aria-hidden /> : <Pause aria-hidden />}
          </button>
        )}
      </div>
    </section>
  );
}
