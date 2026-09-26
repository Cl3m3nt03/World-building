import { CircleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { errorDetail, errorKey } from "@/lib/ipc";

/** Inline, translated message for an error returned by a Tauri command. */
export function AppErrorMessage({ error }: { error: unknown }) {
  const { t } = useTranslation();
  const detail = errorDetail(error);

  return (
    <div
      role="alert"
      className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm"
    >
      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
      <div className="flex flex-col gap-1">
        <p>{t(errorKey(error))}</p>
        {detail !== undefined && (
          <p className="font-mono text-xs break-all text-muted-foreground">{detail}</p>
        )}
      </div>
    </div>
  );
}
