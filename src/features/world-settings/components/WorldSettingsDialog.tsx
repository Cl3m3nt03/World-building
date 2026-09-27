import { useNavigate } from "@tanstack/react-router";
import {
  Images,
  type LucideIcon,
  Palette,
  Settings2,
  Shapes,
  SlidersHorizontal,
} from "lucide-react";
import { Tabs } from "radix-ui";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useUiStore, type WorldSettingsSection } from "@/app/stores/ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useCardTypes } from "@/features/card-types";
import { useAssets } from "@/features/media";
import { ThemeSection } from "@/features/world-theme";
import type { TranslationKey } from "@/i18n";
import type { WorldInfo } from "@/lib/bindings";
import { GeneralSection } from "./GeneralSection";
import { PreferencesSection } from "./PreferencesSection";

const SECTIONS: { value: WorldSettingsSection; icon: LucideIcon; label: TranslationKey }[] = [
  { value: "general", icon: Settings2, label: "worldSettings.sections.general" },
  { value: "types", icon: Shapes, label: "worldSettings.sections.types" },
  { value: "media", icon: Images, label: "worldSettings.sections.media" },
  { value: "theme", icon: Palette, label: "worldSettings.sections.theme" },
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
    <Tabs.Content
      value={value}
      className="flex min-h-0 flex-col gap-4 overflow-y-auto p-5 text-sm outline-none"
    >
      {label && <h2 className="font-heading text-lg font-bold">{t(label)}</h2>}
      {children}
    </Tabs.Content>
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
      <DialogContent className="glass flex h-[85vh] max-h-[48rem] flex-col gap-0 p-0 sm:max-w-4xl">
        <div className="border-b border-border px-5 py-3">
          <DialogTitle>{t("worldSettings.title")}</DialogTitle>
          <DialogDescription className="sr-only">
            {t("worldSettings.description", { name: world.name })}
          </DialogDescription>
        </div>
        {/*
          Radix primitives, not the shadcn wrappers: their vertical styles
          would also apply to the horizontal tabs of the sections (Theme).
        */}
        <Tabs.Root
          orientation="vertical"
          value={section ?? "general"}
          onValueChange={(value) => {
            if (isSection(value)) openSection(value);
          }}
          className="grid min-h-0 flex-1 grid-cols-[12rem_minmax(0,1fr)] gap-0"
        >
          <Tabs.List
            aria-label={t("worldSettings.sectionsLabel")}
            className="flex flex-col gap-0.5 border-r border-border p-2"
          >
            {SECTIONS.map(({ value, icon: Icon, label }) => (
              <Tabs.Trigger
                key={value}
                value={value}
                className="flex h-9 items-center gap-2 rounded-md px-2.5 text-sm font-medium text-muted-foreground outline-none transition hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=active]:bg-accent data-[state=active]:text-foreground [&_svg]:size-4 [&_svg]:shrink-0"
              >
                <Icon aria-hidden />
                {t(label)}
              </Tabs.Trigger>
            ))}
          </Tabs.List>

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
          <Panel value="theme">
            <ThemeSection world={world} />
          </Panel>
          <Panel value="preferences">
            <PreferencesSection world={world} />
          </Panel>
        </Tabs.Root>
      </DialogContent>
    </Dialog>
  );
}
