import { Compass, FolderOpen, Plus, Search } from "lucide-react";
import { type KeyboardEvent, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { RailToggle } from "@/app/shell/WorldRail";
import { useUiStore } from "@/app/stores/ui";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SettingsButton, useSettings } from "@/features/settings";
import type { RecentWorld } from "@/lib/bindings";
import { openDialog as pickFolder } from "@/lib/dialogs";
import {
  useDuplicateWorld,
  useMissingWorlds,
  usePinRecentWorld,
  useRelocateRecentWorld,
  useRemoveRecentWorld,
  useRevealWorld,
} from "../hooks/useRecentWorlds";
import { useOpenWorld } from "../hooks/useWorlds";
import { WorldCard } from "./WorldCard";

/** From this many worlds on, the list can be searched and sorted. */
const SEARCHABLE_FROM = 7;

type Sort = "recent" | "name";

/**
 * Arrows move between the folios of the grid, by their place on screen (the
 * number of columns follows the window); Home and End go to the ends.
 */
function moveInGrid(event: KeyboardEvent<HTMLElement>) {
  const folios = [...event.currentTarget.querySelectorAll<HTMLElement>("[data-world-folio]")];
  const current = folios.indexOf(document.activeElement as HTMLElement);
  const here = folios[current]?.getBoundingClientRect();
  if (!here) return;
  let next: HTMLElement | undefined;
  if (event.key === "ArrowRight") next = folios[current + 1];
  else if (event.key === "ArrowLeft") next = folios[current - 1];
  else if (event.key === "Home") next = folios[0];
  else if (event.key === "End") next = folios[folios.length - 1];
  else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    const down = event.key === "ArrowDown";
    // The nearest folio of the next row, in the same column when there is one.
    const row = folios.filter((folio) => {
      const box = folio.getBoundingClientRect();
      return down ? box.top > here.bottom - 1 : box.bottom < here.top + 1;
    });
    const tops = row.map((folio) => folio.getBoundingClientRect().top);
    const rowTop = down ? Math.min(...tops) : Math.max(...tops);
    const distance = (folio: HTMLElement) =>
      Math.abs(folio.getBoundingClientRect().left - here.left);
    next = row
      .filter((folio) => folio.getBoundingClientRect().top === rowTop)
      .sort((a, b) => distance(a) - distance(b))[0];
  } else return;
  event.preventDefault();
  next?.focus();
}

/**
 * Start screen, the atlas of the worlds (V2, ADR 0012): the last opened world
 * as a banner, the others as folios, the ways to create or open one, and a
 * welcome on the very first launch. A moved world can be relocated, any can
 * be removed from the list.
 */
export function WorldListScreen() {
  const { t, i18n } = useTranslation();
  const settings = useSettings();
  const missing = useMissingWorlds();
  const openWorld = useOpenWorld();
  const removeWorld = useRemoveRecentWorld();
  const relocateWorld = useRelocateRecentWorld();
  const revealWorld = useRevealWorld();
  const pinWorld = usePinRecentWorld();
  const duplicateWorld = useDuplicateWorld();
  const setCreateOpen = useUiStore((state) => state.setCreateWorldOpen);
  const railShown = useUiStore((state) => state.worldRail);
  const [removing, setRemoving] = useState<RecentWorld | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const recentHeadingId = useId();
  const searchId = useId();
  const recentWorlds = settings.data?.recentWorlds ?? [];
  const missingPaths = new Set(missing.data ?? []);
  // No world yet: the welcome holds the actions (none while the settings load).
  const firstLaunch = settings.isSuccess && recentWorlds.length === 0;
  const searchable = recentWorlds.length >= SEARCHABLE_FROM;
  const needle = query.trim().toLocaleLowerCase();
  // The first world (pinned, else the last opened) stands out, unless the
  // list is searched or sorted by name.
  const featured = needle === "" && sort === "recent" ? recentWorlds[0] : undefined;
  const shown = (featured ? recentWorlds.slice(1) : recentWorlds)
    .filter((world) => !needle || world.name.toLocaleLowerCase().includes(needle))
    .sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name, i18n.language) : 0));

  const pickAndOpen = async () => {
    const folder = await pickFolder({
      directory: true,
      multiple: false,
      title: t("worlds.openPickerTitle"),
    });
    if (typeof folder === "string") openWorld.mutate(folder);
  };

  const relocate = async (world: RecentWorld) => {
    const folder = await pickFolder({
      directory: true,
      multiple: false,
      title: t("worlds.relocatePickerTitle", { name: world.name }),
    });
    if (typeof folder === "string") {
      relocateWorld.mutate({ oldPath: world.path, newPath: folder });
    }
  };

  const error =
    openWorld.error ??
    relocateWorld.error ??
    removeWorld.error ??
    revealWorld.error ??
    pinWorld.error ??
    duplicateWorld.error;

  const card = (world: RecentWorld, isFeatured = false) => (
    <WorldCard
      world={world}
      featured={isFeatured}
      missing={missingPaths.has(world.path)}
      disabled={openWorld.isPending || relocateWorld.isPending}
      onOpen={() => openWorld.mutate(world.path)}
      onRelocate={() => void relocate(world)}
      onReveal={() => revealWorld.mutate(world.path)}
      onRemove={() => setRemoving(world)}
      onPin={() => pinWorld.mutate({ path: world.path, pinned: !world.pinned })}
      onDuplicate={() => duplicateWorld.mutate(world.path)}
    />
  );

  const actions = (
    <>
      <Button variant="outline" onClick={pickAndOpen} disabled={openWorld.isPending}>
        <FolderOpen />
        {t("worlds.open")}
      </Button>
      <Button onClick={() => setCreateOpen(true)}>
        <Plus />
        {t("worlds.create")}
      </Button>
    </>
  );

  return (
    <div className="h-full overflow-y-auto">
      {/* Outside the settling column: its animation would make it the button's frame. */}
      {!railShown && <RailToggle className="glass-veil fixed top-3 left-3 z-10" />}
      <SettingsButton className="glass-veil fixed top-3 right-5 z-10 rounded-full" />
      <main className="atlas-settle mx-auto flex w-full max-w-5xl flex-col gap-6 px-8 pt-14 pb-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <p className="rubric on-backdrop">{t("worlds.kicker")}</p>
            <h1 className="text-5xl font-bold">{t("worlds.title")}</h1>
          </div>
          {!firstLaunch && <div className="flex items-center gap-2">{actions}</div>}
        </header>

        {error && <AppErrorMessage error={error} />}

        {firstLaunch ? (
          // First launch: a welcome on the atlas, with the two ways in.
          <section className="glass-panel mx-auto mt-8 flex max-w-lg flex-col items-center gap-4 rounded-xl px-8 py-10 text-center">
            <Compass aria-hidden className="size-12 text-primary" strokeWidth={1.25} />
            <h2 className="text-2xl font-bold">{t("worlds.welcomeTitle")}</h2>
            <p className="text-muted-foreground">{t("worlds.empty")}</p>
            <div className="flex flex-wrap justify-center gap-2">{actions}</div>
          </section>
        ) : (
          <>
            {featured && card(featured, true)}
            {(shown.length > 0 || searchable) && (
              <section aria-labelledby={recentHeadingId} className="flex shrink-0 flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 id={recentHeadingId} className="rubric on-backdrop">
                    {featured ? t("worlds.others") : t("worlds.recent")}
                  </h2>
                  {searchable && (
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search
                          aria-hidden
                          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                        />
                        <label htmlFor={searchId} className="sr-only">
                          {t("worlds.search")}
                        </label>
                        <Input
                          id={searchId}
                          type="search"
                          value={query}
                          onChange={(event) => setQuery(event.target.value)}
                          placeholder={t("worlds.search")}
                          className="w-56 pl-8"
                        />
                      </div>
                      <Select value={sort} onValueChange={(value) => setSort(value as Sort)}>
                        <SelectTrigger aria-label={t("worlds.sort")} className="w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="recent">{t("worlds.sortRecent")}</SelectItem>
                          <SelectItem value="name">{t("worlds.sortName")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                {shown.length === 0 ? (
                  <p className="on-backdrop text-sm text-muted-foreground">
                    {t("worlds.noMatch", { query })}
                  </p>
                ) : (
                  <ul
                    onKeyDown={moveInGrid}
                    className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-4"
                  >
                    {shown.map((world) => (
                      <li key={world.path} className="flex">
                        {card(world)}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </>
        )}

        <Dialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("worlds.removeTitle", { name: removing?.name ?? "" })}</DialogTitle>
              <DialogDescription>{t("worlds.removeDescription")}</DialogDescription>
            </DialogHeader>
            <p className="text-xs break-all text-muted-foreground">{removing?.path}</p>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setRemoving(null)}>
                {t("createWorld.cancel")}
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (removing) removeWorld.mutate(removing.path);
                  setRemoving(null);
                }}
              >
                {t("worlds.remove")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
