import { FolderOpen, Plus } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
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
import { SettingsButton, useSettings } from "@/features/settings";
import type { RecentWorld } from "@/lib/bindings";
import { openDialog as pickFolder } from "@/lib/dialogs";
import {
  useMissingWorlds,
  useRelocateRecentWorld,
  useRemoveRecentWorld,
  useRevealWorld,
} from "../hooks/useRecentWorlds";
import { useOpenWorld } from "../hooks/useWorlds";
import { CreateWorldDialog } from "./CreateWorldDialog";
import { WorldCard } from "./WorldCard";

/**
 * Start screen: create a world, open a world folder, reopen a recent world,
 * relocate a moved one or remove one from the list.
 */
export function WorldListScreen() {
  const { t } = useTranslation();
  const settings = useSettings();
  const missing = useMissingWorlds();
  const openWorld = useOpenWorld();
  const removeWorld = useRemoveRecentWorld();
  const relocateWorld = useRelocateRecentWorld();
  const revealWorld = useRevealWorld();
  const [createOpen, setCreateOpen] = useState(false);
  const [removing, setRemoving] = useState<RecentWorld | null>(null);
  const recentHeadingId = useId();
  const recentWorlds = settings.data?.recentWorlds ?? [];
  const missingPaths = new Set(missing.data ?? []);

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

  const error = openWorld.error ?? relocateWorld.error ?? removeWorld.error ?? revealWorld.error;

  return (
    <main className="mx-auto flex h-full w-full max-w-5xl flex-col gap-8 px-8 pt-16">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-4xl font-bold">{t("worlds.title")}</h1>
        <div className="flex items-center gap-2">
          <SettingsButton className="rounded-full" />
          <Button variant="secondary" onClick={pickAndOpen} disabled={openWorld.isPending}>
            <FolderOpen />
            {t("worlds.open")}
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus />
            {t("worlds.create")}
          </Button>
        </div>
      </header>

      {error && <AppErrorMessage error={error} />}

      <section aria-labelledby={recentHeadingId} className="flex min-h-0 flex-col gap-3">
        <h2 id={recentHeadingId} className="text-sm font-bold text-muted-foreground">
          {t("worlds.recent")}
        </h2>
        {recentWorlds.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("worlds.empty")}</p>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-4 overflow-y-auto pb-8">
            {recentWorlds.map((world) => (
              <li key={world.path} className="flex">
                <WorldCard
                  world={world}
                  missing={missingPaths.has(world.path)}
                  disabled={openWorld.isPending || relocateWorld.isPending}
                  onOpen={() => openWorld.mutate(world.path)}
                  onRelocate={() => void relocate(world)}
                  onReveal={() => revealWorld.mutate(world.path)}
                  onRemove={() => setRemoving(world)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <CreateWorldDialog open={createOpen} onOpenChange={setCreateOpen} />

      <Dialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("worlds.removeTitle", { name: removing?.name ?? "" })}</DialogTitle>
            <DialogDescription>{t("worlds.removeDescription")}</DialogDescription>
          </DialogHeader>
          <p className="font-mono text-xs break-all text-muted-foreground">{removing?.path}</p>
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
  );
}
