import { CalendarDays, Plus, Trash2 } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { DEFAULT_CALENDAR, formatDate, toDays } from "@/features/timelines/calendar";
import { useCalendarWords } from "@/features/timelines/useCalendar";
import { useSetWorldCalendar } from "@/features/world";
import type { WorldCalendar, WorldInfo } from "@/lib/bindings";

/** Most months and eras (the Rust side checks the same). */
const MAX_MONTHS = 24;
const MAX_ERAS = 20;

/** The days of the Gregorian months (no leap years). */
const GREGORIAN_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Why a calendar cannot be kept, as a translation key; null when it can. */
function problem(calendar: WorldCalendar) {
  if (calendar.months.length === 0) return "worldSettings.calendar.needsMonth" as const;
  if (calendar.months.some((month) => !(month.days >= 1 && month.days <= 400))) {
    return "worldSettings.calendar.badDays" as const;
  }
  const starts = calendar.eras.map((era) => era.startYear);
  if (new Set(starts).size !== starts.length) return "worldSettings.calendar.sameStart" as const;
  return null;
}

/**
 * The world's calendar (ADR 0011): its eras and its months, with a date
 * written as the timelines will write it. Kept when « Enregistrer » is
 * pressed, once valid.
 */
export function CalendarSection({ world }: { world: WorldInfo }) {
  const { t } = useTranslation();
  const words = useCalendarWords();
  const save = useSetWorldCalendar();
  const id = useId();
  const [draft, setDraft] = useState<WorldCalendar>(world.calendar);
  useEffect(() => setDraft(world.calendar), [world.calendar]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(world.calendar);
  const issue = problem(draft);

  const setMonth = (index: number, patch: Partial<WorldCalendar["months"][number]>) =>
    setDraft((current) => ({
      ...current,
      months: current.months.map((month, at) => (at === index ? { ...month, ...patch } : month)),
    }));
  const setEra = (index: number, patch: Partial<WorldCalendar["eras"][number]>) =>
    setDraft((current) => ({
      ...current,
      eras: current.eras.map((era, at) => (at === index ? { ...era, ...patch } : era)),
    }));

  // A date to show the calendar at work: the 12th of the 3rd month, 298 years in.
  const firstEra = [...draft.eras]
    .sort((a, b) => a.startYear - b.startYear)
    .find((era) => !era.backwards);
  const sampleYear = (firstEra?.startYear ?? 0) + 298;
  const sample =
    issue === null
      ? formatDate(draft, toDays(draft, { year: sampleYear, month: 3, day: 12 }), "day", words)
      : "";

  return (
    <div className="flex flex-col gap-5">
      <p className="text-muted-foreground">{t("worldSettings.calendar.intro")}</p>

      <div className="flex flex-wrap gap-2">
        <span className="self-center text-xs text-muted-foreground">
          {t("worldSettings.calendar.presets")}
        </span>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setDraft((current) => ({ ...current, months: DEFAULT_CALENDAR.months }))}
        >
          {t("worldSettings.calendar.presetSimple")}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            setDraft((current) => ({
              ...current,
              months: GREGORIAN_DAYS.map((days, index) => ({
                name: t(
                  `worldSettings.calendar.gregorian.${index + 1}` as "worldSettings.calendar.gregorian.1",
                ),
                days,
              })),
            }))
          }
        >
          {t("worldSettings.calendar.presetGregorian")}
        </Button>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-semibold">{t("worldSettings.calendar.eras")}</legend>
        {draft.eras.length === 0 && (
          <p className="text-muted-foreground">{t("worldSettings.calendar.noEras")}</p>
        )}
        {draft.eras.map((era, index) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: eras are edited in place
            key={index}
            className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-3"
          >
            <div className="flex min-w-40 flex-1 flex-col gap-1">
              <label htmlFor={`${id}-era-${index}-name`} className="text-xs text-muted-foreground">
                {t("worldSettings.calendar.eraName")}
              </label>
              <Input
                id={`${id}-era-${index}-name`}
                value={era.name}
                maxLength={60}
                onChange={(event) => setEra(index, { name: event.target.value })}
              />
            </div>
            <div className="flex w-24 flex-col gap-1">
              <label htmlFor={`${id}-era-${index}-abbr`} className="text-xs text-muted-foreground">
                {t("worldSettings.calendar.eraAbbreviation")}
              </label>
              <Input
                id={`${id}-era-${index}-abbr`}
                value={era.abbreviation}
                maxLength={60}
                onChange={(event) => setEra(index, { abbreviation: event.target.value })}
              />
            </div>
            <div className="flex w-28 flex-col gap-1">
              <label htmlFor={`${id}-era-${index}-start`} className="text-xs text-muted-foreground">
                {t("worldSettings.calendar.eraStart")}
              </label>
              <Input
                id={`${id}-era-${index}-start`}
                type="number"
                value={era.startYear}
                onChange={(event) =>
                  setEra(index, { startYear: Math.round(Number(event.target.value) || 0) })
                }
              />
            </div>
            <div className="flex items-center gap-2 pb-2">
              <Switch
                id={`${id}-era-${index}-back`}
                checked={era.backwards ?? false}
                onCheckedChange={(backwards) => setEra(index, { backwards })}
              />
              <label htmlFor={`${id}-era-${index}-back`} className="text-xs">
                {t("worldSettings.calendar.eraBackwards")}
              </label>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("worldSettings.calendar.removeEra", {
                name: era.name || era.abbreviation,
              })}
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  eras: current.eras.filter((_, at) => at !== index),
                }))
              }
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          disabled={draft.eras.length >= MAX_ERAS}
          onClick={() =>
            setDraft((current) => ({
              ...current,
              eras: [
                ...current.eras,
                {
                  name: "",
                  abbreviation: "",
                  startYear: Math.max(0, ...current.eras.map((era) => era.startYear + 1)),
                  backwards: false,
                },
              ],
            }))
          }
        >
          <Plus />
          {t("worldSettings.calendar.addEra")}
        </Button>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-semibold">
          {t("worldSettings.calendar.months", {
            count: draft.months.length,
            days: draft.months.reduce((sum, month) => sum + month.days, 0),
          })}
        </legend>
        <ol className="grid gap-2 sm:grid-cols-2">
          {draft.months.map((month, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: months are known by their place
            <li key={index} className="flex items-center gap-2">
              <span
                aria-hidden
                className="w-6 text-right text-xs text-muted-foreground tabular-nums"
              >
                {index + 1}
              </span>
              <label htmlFor={`${id}-month-${index}`} className="sr-only">
                {t("worldSettings.calendar.monthName", { number: index + 1 })}
              </label>
              <Input
                id={`${id}-month-${index}`}
                value={month.name}
                maxLength={60}
                placeholder={words.month(index + 1)}
                onChange={(event) => setMonth(index, { name: event.target.value })}
              />
              <label htmlFor={`${id}-month-${index}-days`} className="sr-only">
                {t("worldSettings.calendar.monthDays", { number: index + 1 })}
              </label>
              <Input
                id={`${id}-month-${index}-days`}
                type="number"
                min={1}
                max={400}
                value={month.days}
                onChange={(event) =>
                  setMonth(index, { days: Math.round(Number(event.target.value) || 0) })
                }
                className="w-20"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={draft.months.length <= 1}
                aria-label={t("worldSettings.calendar.removeMonth", { number: index + 1 })}
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    months: current.months.filter((_, at) => at !== index),
                  }))
                }
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ol>
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          disabled={draft.months.length >= MAX_MONTHS}
          onClick={() =>
            setDraft((current) => ({
              ...current,
              months: [...current.months, { name: "", days: 30 }],
            }))
          }
        >
          <Plus />
          {t("worldSettings.calendar.addMonth")}
        </Button>
      </fieldset>

      <div
        className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 p-3"
        aria-live="polite"
      >
        <CalendarDays aria-hidden className="size-4 text-muted-foreground" />
        {issue ? (
          <span className="text-destructive">{t(issue)}</span>
        ) : (
          <span>{t("worldSettings.calendar.sample", { date: sample })}</span>
        )}
      </div>
      {save.error ? <AppErrorMessage error={save.error} /> : null}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" disabled={!dirty} onClick={() => setDraft(world.calendar)}>
          {t("worldSettings.calendar.reset")}
        </Button>
        <Button
          disabled={!dirty || issue !== null || save.isPending}
          onClick={() => save.mutate(draft)}
        >
          {t("worldSettings.calendar.save")}
        </Button>
      </div>
    </div>
  );
}
