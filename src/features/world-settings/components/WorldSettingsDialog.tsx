import { useNavigate } from "@tanstack/react-router";
import { Images, type LucideIcon, Settings2, Shapes, SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useUiStore, type WorldSettingsSection } from "@/app/stores/ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCardTypes } from "@/features/card-types";
import { useAssets } from "@/features/media";
import type { TranslationKey } from "@/i18n";
import type { WorldInfo } from "@/lib/bindings";
import { GeneralSection } from "./GeneralSection";
import { PreferencesSection } from "./PreferencesSection";

const SECTIONS: { value: WorldSettingsSection; icon: LucideIcon; label: TranslationKey }[] = [
  { value: "general", icon: Settings2, label: "worldSettings.sections.general" },
  { value: "types", icon: Shapes, label: "worldSettings.sections.types" },
  { value: "media", icon: Images, label: "worldSettings.sections.media" },
  { value: "preferences", icon: SlidersHorizontal, label: "worldSettings.sections.preferences" },
];

function isSection(value: string): value is WorldSettingsSection {
  return SECTIONS.some((section) => section.value === value);
}

/** The content of a section, under its title. */
function Panel({ value, children }: { value: WorldSettingsSection; children: ReactNode }) {
  const { t } = useTranslation();
  const label = SECTIONS.find((section) => section.value === value)?.label;
  return (
    <TabsContent value={value} className="flex min-h-0 flex-col gap-4 overflow-y-auto p-5">
      {label && <h2 className="font-heading text-lg font-bold">{t(label)}</h2>}
      {children}
    </TabsContent>
  );
}

/** A section that leads to a screen of its own. */
function LinkSection({
  text,
  summary,
  action,
  onAction,
}: {
  text: string;
  summary: string;
  action: ReactNode;
  onAction: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-sm text-muted-foreground">{text}</p>
      <p className="text-sm">{summary}</p>
      <Button variant="secondary" onClick={onAction}>
        {action}
      </Button>
    </div>
  );
}

/**
 * World settings screen, in sections (after vvd): general information, card
 * types, media library, preferences and the danger zone. Opened from the
 * world button of the top bar and from Home › Manage.
 */
export function WorldSettingsDialog({ world }: { world: WorldInfo }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const section = useUiStore((state) => state.worldSettings);
  const openSection = useUiStore((state) => state.openWorldSettings);
  const close = useUiStore((state) => state.closeWorldSettings);
  const openCardTypes = useUiStore((state) => state.setCardTypesOpen);
  const types = useCardTypes();
  const assets = useAssets({ kind: null, search: null });
  const typeCount = types.data?.filter((type) => type.parentId === null).length;
  const fileCount = assets.data?.length;

  return (
    <Dialog open={section !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="glass flex h-[80vh] max-h-[44rem] flex-col gap-0 p-0 sm:max-w-3xl">
        <div className="border-b border-border px-5 py-3">
          <DialogTitle>{t("worldSettings.title")}</DialogTitle>
          <DialogDescription className="sr-only">
            {t("worldSettings.description", { name: world.name })}
          </DialogDescription>
        </div>
        <Tabs
          orientation="vertical"
          value={section ?? "general"}
          onValueChange={(value) => {
            if (isSection(value)) openSection(value);
          }}
          className="grid min-h-0 flex-1 grid-cols-[12rem_minmax(0,1fr)] gap-0"
        >
          <TabsList
            aria-label={t("worldSettings.sectionsLabel")}
            className="w-full items-stretch justify-start gap-0.5 rounded-none border-r border-border bg-transparent p-2"
          >
            {SECTIONS.map(({ value, icon: Icon, label }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="h-9 flex-none justify-start gap-2 px-2.5 data-[state=active]:bg-accent data-[state=active]:shadow-none dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-accent"
              >
                <Icon />
                {t(label)}
              </TabsTrigger>
            ))}
          </TabsList>

          <Panel value="general">
            <GeneralSection world={world} />
          </Panel>
          <Panel value="types">
            <LinkSection
              text={t("worldSettings.types.text")}
              summary={
                typeCount === undefined ? "" : t("worldSettings.types.count", { count: typeCount })
              }
              action={
                <>
                  <Shapes />
                  {t("worldSettings.types.open")}
                </>
              }
              onAction={() => {
                close();
                openCardTypes(true);
              }}
            />
          </Panel>
          <Panel value="media">
            <LinkSection
              text={t("worldSettings.media.text")}
              summary={fileCount === undefined ? "" : t("home.fileCount", { count: fileCount })}
              action={
                <>
                  <Images />
                  {t("worldSettings.media.open")}
                </>
              }
              onAction={() => {
                close();
                void navigate({ to: "/world/$worldId/media", params: { worldId: world.id } });
              }}
            />
          </Panel>
          <Panel value="preferences">
            <PreferencesSection world={world} />
          </Panel>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
