import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DatePrecision, WorldCalendar } from "@/lib/bindings";
import { eraYear, fromDays, fromEraYear, monthName, toDays } from "../calendar";
import { useCalendarWords } from "../useCalendar";

/** A date and what it names (a year, a month or a day). */
export type DateValue = { days: number; precision: DatePrecision };

type Props = {
  /** Its name, said by its fieldset. */
  legend: string;
  calendar: WorldCalendar;
  value: DateValue;
  onChange: (value: DateValue) => void;
};

/** « No month » and « no day » in the selects. */
const NONE = "none";

/**
 * A date in the world's calendar: the era, the year counted in it, then a
 * month and a day if wanted (without them, the date names a year or a
 * month).
 */
export function DateField({ legend, calendar, value, onChange }: Props) {
  const { t } = useTranslation();
  const words = useCalendarWords();
  const id = useId();
  const date = fromDays(calendar, value.days);
  const counted = eraYear(calendar, date.year);
  const eras = [...calendar.eras].sort((a, b) => a.startYear - b.startYear);
  const month = value.precision === "year" ? null : date.month;
  const day = value.precision === "day" ? date.day : null;

  const change = (next: {
    year?: number;
    eraIndex?: number | null;
    month?: number | null;
    day?: number | null;
  }) => {
    const era = next.eraIndex === undefined ? counted.era : (eras[next.eraIndex ?? -1] ?? null);
    const year = fromEraYear(calendar, era, next.year ?? counted.year);
    const nextMonth = next.month === undefined ? month : next.month;
    const nextDay = nextMonth === null ? null : next.day === undefined ? day : next.day;
    onChange({
      days: toDays(calendar, { year, month: nextMonth ?? 1, day: nextDay ?? 1 }),
      precision: nextMonth === null ? "year" : nextDay === null ? "month" : "day",
    });
  };

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1 text-xs font-medium text-muted-foreground">{legend}</legend>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={`${id}-day`} className="sr-only">
          {t("calendar.day")}
        </label>
        <Input
          id={`${id}-day`}
          type="number"
          min={1}
          max={calendar.months[(month ?? 1) - 1]?.days ?? 31}
          disabled={month === null}
          placeholder={t("calendar.day")}
          value={day ?? ""}
          onChange={(event) =>
            change({ day: event.target.value === "" ? null : Number(event.target.value) })
          }
          className="w-20"
        />
        <Select
          value={month === null ? NONE : String(month)}
          onValueChange={(next) => change({ month: next === NONE ? null : Number(next) })}
        >
          <SelectTrigger aria-label={t("calendar.month")} className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>{t("calendar.noMonth")}</SelectItem>
            {calendar.months.map((_, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: months are known by their place
              <SelectItem key={index} value={String(index + 1)}>
                {monthName(calendar, index + 1, words)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label htmlFor={`${id}-year`} className="sr-only">
          {t("calendar.year")}
        </label>
        <Input
          id={`${id}-year`}
          type="number"
          value={counted.year}
          onChange={(event) => {
            const year = Number(event.target.value);
            if (Number.isFinite(year)) change({ year: Math.round(year) });
          }}
          className="w-28"
        />
        {eras.length > 0 && (
          <Select
            value={String(counted.era ? eras.indexOf(counted.era) : -1)}
            onValueChange={(next) => change({ eraIndex: Number(next) })}
          >
            <SelectTrigger aria-label={t("calendar.era")} className="w-36">
              <SelectValue placeholder={t("calendar.noEra")} />
            </SelectTrigger>
            <SelectContent>
              {eras.map((era, index) => (
                <SelectItem key={`${era.startYear}`} value={String(index)}>
                  {era.abbreviation.trim() || era.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </fieldset>
  );
}
