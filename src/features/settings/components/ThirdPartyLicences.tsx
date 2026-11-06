import { ArrowLeft, Search } from "lucide-react";
import { useDeferredValue, useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TranslationKey } from "@/i18n";
import { useThirdPartyNotices } from "../hooks/useThirdPartyNotices";
import { filterNotices, type NoticeSection } from "../notices";

// The group labels of the notices file, shown translated (the texts stay English).
const GROUP_LABELS: Record<string, TranslationKey> = {
  "Rust crates": "about.licences.rust",
  "JavaScript packages": "about.licences.js",
  "Bundled assets": "about.licences.assets",
};

function Section({ section }: { section: NoticeSection }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const textId = useId();
  return (
    <li className="flex flex-col gap-1.5 rounded-md border border-border p-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-mono text-xs font-semibold break-all">{section.licence}</h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 shrink-0 px-2 text-xs"
          aria-expanded={open}
          aria-controls={textId}
          onClick={() => setOpen((value) => !value)}
        >
          {t(open ? "about.licences.hideText" : "about.licences.showText")}
        </Button>
      </div>
      {section.groups.map((group) => {
        const label = GROUP_LABELS[group.label];
        return (
          <p key={group.label} className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{label ? t(label) : group.label}</span>
            {t("about.licences.colon")}
            {group.items.join(", ")}
          </p>
        );
      })}
      {section.sources.length > 0 && (
        <ul className="text-xs text-muted-foreground">
          {section.sources.map((source) => (
            <li key={source} className="break-all">
              {t("about.licences.source")}
              {t("about.licences.colon")}
              {source}
            </li>
          ))}
        </ul>
      )}
      {open && (
        <pre
          id={textId}
          lang="en"
          className="max-h-80 overflow-auto rounded-sm bg-muted p-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap"
        >
          {section.text}
        </pre>
      )}
    </li>
  );
}

/** The licences of the software and fonts shipped with the app (Settings › About). */
export function ThirdPartyLicences({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const notices = useThirdPartyNotices();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const searchId = useId();
  const sections = useMemo(
    () => filterNotices(notices.data?.sections ?? [], deferredQuery),
    [notices.data, deferredQuery],
  );

  return (
    // The list scrolls under a fixed header (the search stays in view).
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 flex-col gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft />
            {t("about.licences.back")}
          </Button>
          <h3 className="font-heading text-base font-bold">{t("about.licences.title")}</h3>
        </div>
        <p className="text-xs text-muted-foreground">{t("about.licences.intro")}</p>
        {notices.isSuccess && notices.data.sections.length > 0 && (
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <label htmlFor={searchId} className="sr-only">
              {t("about.licences.search")}
            </label>
            <Input
              id={searchId}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("about.licences.search")}
              className="pl-8"
            />
          </div>
        )}
      </div>
      {notices.isPending && <p className="text-sm text-muted-foreground">{t("about.loading")}</p>}
      {notices.isError && <AppErrorMessage error={notices.error} />}
      {notices.isSuccess && notices.data.sections.length === 0 && (
        <pre lang="en" className="font-mono text-xs whitespace-pre-wrap">
          {notices.data.intro}
        </pre>
      )}
      {notices.isSuccess && notices.data.sections.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {sections.length === 0
              ? t("about.licences.empty")
              : t("about.licences.count", { count: sections.length })}
          </p>
          <ul className="-mr-2 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-2">
            {sections.map((section) => (
              <Section key={section.id} section={section} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
