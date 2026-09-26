import { open as pickFolder } from "@tauri-apps/plugin-dialog";
import { FolderOpen, Globe, Plus } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import { SettingsButton, useSettings } from "@/features/settings";
import { useOpenWorld } from "../hooks/useWorlds";
import { CreateWorldDialog } from "./CreateWorldDialog";

function formatDate(iso: string, language: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" }).format(
    date,
  );
}

/** Start screen: create a world, open a world folder, or reopen a recent world. */
export function WorldListScreen() {
  const { t, i18n } = useTranslation();
  const settings = useSettings();
  const openWorld = useOpenWorld();
  const [createOpen, setCreateOpen] = useState(false);
  const recentHeadingId = useId();
  const recentWorlds = settings.data?.recentWorlds ?? [];

  const pickAndOpen = async () => {
    const folder = await pickFolder({
      directory: true,
      multiple: false,
      title: t("worlds.openPickerTitle"),
    });
    if (typeof folder === "string") openWorld.mutate(folder);
  };

  return (
    <main className="mx-auto flex h-full w-full max-w-3xl flex-col gap-8 px-8 pt-16">
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

      {openWorld.isError && <AppErrorMessage error={openWorld.error} />}

      <section aria-labelledby={recentHeadingId} className="flex min-h-0 flex-col gap-3">
        <h2 id={recentHeadingId} className="text-sm font-bold text-muted-foreground">
          {t("worlds.recent")}
        </h2>
        {recentWorlds.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("worlds.empty")}</p>
        ) : (
          <ul className="flex flex-col gap-2 overflow-y-auto pb-8">
            {recentWorlds.map((world) => (
              <li key={world.path}>
                <button
                  type="button"
                  onClick={() => openWorld.mutate(world.path)}
                  disabled={openWorld.isPending}
                  aria-label={t("worlds.openRecent", { name: world.name })}
                  className="glass flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
                >
                  <Globe aria-hidden className="size-5 shrink-0 text-primary" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-heading font-bold">{world.name}</span>
                    <span className="truncate font-mono text-xs text-muted-foreground">
                      {world.path}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDate(world.lastOpenedAt, i18n.language)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <CreateWorldDialog open={createOpen} onOpenChange={setCreateOpen} />
    </main>
  );
}
