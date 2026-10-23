import { Palette } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import type { TranslationKey } from "@/i18n";
import type { AppInfo } from "@/lib/bindings";
import { useAppInfo } from "../hooks/useAppInfo";

const ROWS: { key: keyof AppInfo; label: TranslationKey }[] = [
  { key: "version", label: "about.version" },
  { key: "configDir", label: "about.configDir" },
  { key: "dataDir", label: "about.dataDir" },
  { key: "logDir", label: "about.logDir" },
];

/** Version and folders of the app, shown in the settings, and the way to the design system. */
export function AboutSection({ enabled = true }: { enabled?: boolean }) {
  const { t } = useTranslation();
  const appInfo = useAppInfo({ enabled });

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">{t("about.description")}</p>
      {appInfo.isPending && <p className="text-sm text-muted-foreground">{t("about.loading")}</p>}
      {appInfo.isError && <AppErrorMessage error={appInfo.error} />}
      {appInfo.isSuccess && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          {ROWS.map(({ key, label }) => (
            <div key={key} className="contents">
              <dt className="text-muted-foreground">{t(label)}</dt>
              <dd className="font-mono text-xs break-all">{appInfo.data[key]}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          {/* A plain hash link: the hash history follows it, with or without a router around. */}
          <a href="#/design-system">
            <Palette />
            {t("about.designSystem")}
          </a>
        </Button>
        <span className="text-xs text-muted-foreground">{t("about.designSystemHint")}</span>
      </div>
    </div>
  );
}
