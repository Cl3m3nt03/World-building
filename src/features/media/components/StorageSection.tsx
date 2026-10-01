import { type FormEvent, useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { StorageUsage } from "@/lib/bindings";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useSetStorageLimit, useWorldStorage } from "../hooks/useStorage";
import {
  isDiskLow,
  limitBytes,
  limitParts,
  MIN_LIMIT,
  type StorageUnit,
  storageLevel,
} from "../storage";

/**
 * Space used by the open world (database, media, backups), left on its disk,
 * and the limit chosen for it (M3 step 3.12): at 90 % BuilderZ warns, at
 * 100 % imports are refused; nothing else is blocked.
 */
export function StorageSection() {
  const { t, i18n } = useTranslation();
  const storage = useWorldStorage();
  const usage = storage.data;
  const bytes = (value: number | null) => formatBytes(value ?? 0, i18n.language);

  if (storage.isError) return <AppErrorMessage error={storage.error} />;
  if (!usage) return null;

  const rows: [string, number | null][] = [
    [t("storage.media", { count: usage.mediaCount }), usage.media],
    [t("storage.database"), usage.database],
    [t("storage.backups"), usage.backups],
  ];

  return (
    <section aria-labelledby="storage-title" className="flex flex-col gap-3">
      <h3 id="storage-title" className="font-medium">
        {t("storage.title")}
      </h3>
      <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right tabular-nums">{bytes(value)}</dd>
          </div>
        ))}
        <dt className="font-medium">{t("storage.total")}</dt>
        <dd className="text-right font-medium tabular-nums">{bytes(usage.total)}</dd>
        {usage.available !== null && (
          <>
            <dt className="text-muted-foreground">{t("storage.available")}</dt>
            <dd className="text-right tabular-nums">{bytes(usage.available)}</dd>
          </>
        )}
      </dl>
      <StorageWarnings usage={usage} />
      <LimitForm usage={usage} />
    </section>
  );
}

/** What the user should know about the space: near or at the limit, disk nearly full. */
export function StorageWarnings({ usage }: { usage: StorageUsage }) {
  const { t, i18n } = useTranslation();
  const level = storageLevel(usage);
  const limit = formatBytes(usage.limit ?? 0, i18n.language);
  return (
    <>
      {level !== "ok" && (
        <p
          role={level === "full" ? "alert" : "status"}
          className={cn(
            "rounded-md border p-3 text-sm",
            level === "full"
              ? "border-destructive/30 bg-destructive/10"
              : "border-border bg-muted/50",
          )}
        >
          {level === "full" ? t("storage.full", { limit }) : t("storage.nearlyFull", { limit })}
        </p>
      )}
      {isDiskLow(usage) && (
        <p role="status" className="rounded-md border border-border bg-muted/50 p-3 text-sm">
          {t("storage.diskLow", { available: formatBytes(usage.available ?? 0, i18n.language) })}
        </p>
      )}
    </>
  );
}

function LimitForm({ usage }: { usage: StorageUsage }) {
  const { t, i18n } = useTranslation();
  const setLimit = useSetStorageLimit();
  const switchId = useId();
  const valueId = useId();
  const unitId = useId();
  const saved = usage.limit === null ? null : limitParts(usage.limit);
  const [value, setValue] = useState(String(saved?.value ?? 1));
  const [unit, setUnit] = useState<StorageUnit>(saved?.unit ?? "GB");

  useEffect(() => {
    if (usage.limit === null) return;
    const parts = limitParts(usage.limit);
    setValue(String(parts.value));
    setUnit(parts.unit);
  }, [usage.limit]);

  const wanted = limitBytes(Number(value.replace(",", ".")), unit);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (wanted !== null) setLimit.mutate(wanted);
  };
  const share =
    usage.limit === null ? 0 : Math.min(100, Math.round(((usage.total ?? 0) / usage.limit) * 100));

  return (
    <div className="flex flex-col gap-3 border-t pt-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <Label htmlFor={switchId}>{t("storage.limit")}</Label>
          <p className="text-xs text-muted-foreground">{t("storage.limitHint")}</p>
        </div>
        <Switch
          id={switchId}
          checked={usage.limit !== null}
          disabled={setLimit.isPending}
          onCheckedChange={(checked) =>
            setLimit.mutate(checked ? Math.max(wanted ?? MIN_LIMIT, MIN_LIMIT) : null)
          }
        />
      </div>
      {usage.limit !== null && (
        <>
          <progress
            aria-label={t("storage.limitUse", { share })}
            value={share}
            max={100}
            className={cn(
              "h-2 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-muted",
              storageLevel(usage) === "ok"
                ? "[&::-webkit-progress-value]:bg-primary"
                : "[&::-webkit-progress-value]:bg-destructive",
            )}
          />
          <p className="text-xs text-muted-foreground">
            {t("storage.limitDetail", {
              share,
              used: formatBytes(usage.total ?? 0, i18n.language),
              limit: formatBytes(usage.limit, i18n.language),
            })}
          </p>
          <form onSubmit={submit} className="flex items-end gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor={valueId}>{t("storage.limitValue")}</Label>
              <Input
                id={valueId}
                inputMode="decimal"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                className="h-8 w-28"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={unitId}>{t("storage.limitUnit")}</Label>
              <Select value={unit} onValueChange={(next) => setUnit(next === "MB" ? "MB" : "GB")}>
                <SelectTrigger id={unitId} size="sm" className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MB">{t("storage.unitMB")}</SelectItem>
                  <SelectItem value="GB">{t("storage.unitGB")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              disabled={wanted === null || wanted === usage.limit || setLimit.isPending}
            >
              {t("storage.limitApply")}
            </Button>
          </form>
        </>
      )}
      {setLimit.isError && <AppErrorMessage error={setLimit.error} />}
    </div>
  );
}
