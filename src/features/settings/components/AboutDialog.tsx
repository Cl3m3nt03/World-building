import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TranslationKey } from "@/i18n";
import type { AppInfo } from "@/lib/bindings";
import { useAppInfo } from "../hooks/useAppInfo";

const ROWS: { key: keyof AppInfo; label: TranslationKey }[] = [
  { key: "version", label: "about.version" },
  { key: "configDir", label: "about.configDir" },
  { key: "dataDir", label: "about.dataDir" },
  { key: "logDir", label: "about.logDir" },
];

type AboutDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AboutDialog({ open, onOpenChange }: AboutDialogProps) {
  const { t } = useTranslation();
  const appInfo = useAppInfo({ enabled: open });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("about.title")}</DialogTitle>
          <DialogDescription>{t("about.description")}</DialogDescription>
        </DialogHeader>
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
      </DialogContent>
    </Dialog>
  );
}
