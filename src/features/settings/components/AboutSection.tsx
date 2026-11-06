import { Palette, ScrollText } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { BrandEmblem } from "@/components/BrandEmblem";
import { MiddleTruncate } from "@/components/MiddleTruncate";
import { Button } from "@/components/ui/button";
// The font list alone: the feature's index would pull the world feature in.
import { HEADING_FONT_NAMES } from "@/features/world-theme/headingFonts";
import type { TranslationKey } from "@/i18n";
import type { AppInfo } from "@/lib/bindings";
import { useAppInfo } from "../hooks/useAppInfo";
import { ThirdPartyLicences } from "./ThirdPartyLicences";

const ROWS: { key: keyof AppInfo; label: TranslationKey }[] = [
  { key: "version", label: "about.version" },
  { key: "configDir", label: "about.configDir" },
  { key: "dataDir", label: "about.dataDir" },
  { key: "logDir", label: "about.logDir" },
];

/**
 * Version and folders of the app, shown in the settings, the way to the
 * design system and the third-party licences (shown in place of the section).
 */
export function AboutSection({ enabled = true }: { enabled?: boolean }) {
  const { t } = useTranslation();
  const appInfo = useAppInfo({ enabled });
  const [licences, setLicences] = useState(false);
  const licencesButton = useRef<HTMLButtonElement>(null);
  const returning = useRef(false);

  // Back from the licences: focus goes back to the button that opened them.
  useEffect(() => {
    if (!licences && returning.current) {
      returning.current = false;
      licencesButton.current?.focus();
    }
  }, [licences]);

  if (licences) {
    return (
      <ThirdPartyLicences
        onBack={() => {
          returning.current = true;
          setLicences(false);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <BrandEmblem className="size-12 shrink-0" />
        <p className="text-sm text-muted-foreground">{t("about.description")}</p>
      </div>
      {appInfo.isPending && <p className="text-sm text-muted-foreground">{t("about.loading")}</p>}
      {appInfo.isError && <AppErrorMessage error={appInfo.error} />}
      {appInfo.isSuccess && (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2 text-sm">
          {ROWS.map(({ key, label }) => (
            <div key={key} className="contents">
              <dt className="text-muted-foreground">{t(label)}</dt>
              <dd className="min-w-0">
                <MiddleTruncate text={appInfo.data[key]} className="text-xs" />
              </dd>
            </div>
          ))}
        </dl>
      )}
      <p className="text-xs text-muted-foreground">
        {t("about.fonts", { fonts: Object.values(HEADING_FONT_NAMES).join(", ") })}
      </p>
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
      <div className="flex items-center gap-3">
        <Button ref={licencesButton} variant="outline" size="sm" onClick={() => setLicences(true)}>
          <ScrollText />
          {t("about.licences.open")}
        </Button>
        <span className="text-xs text-muted-foreground">{t("about.licences.hint")}</span>
      </div>
      <p className="text-xs text-muted-foreground">{t("about.copyright")}</p>
    </div>
  );
}
