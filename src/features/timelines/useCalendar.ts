import { useTranslation } from "react-i18next";
import { useCurrentWorld } from "@/features/world";
import type { DatePrecision, WorldCalendar } from "@/lib/bindings";
import { type CalendarWords, DEFAULT_CALENDAR, formatDate } from "./calendar";

/** The words of the dates in the app's language. */
export function useCalendarWords(): CalendarWords {
  const { t } = useTranslation();
  return {
    month: (number) => t("calendar.monthNumber", { count: number }),
    day: (day, month, year, named) =>
      t(named ? "calendar.dayNamed" : "calendar.dayNumbered", { day, month, year }),
    monthYear: (month, year) => t("calendar.monthYear", { month, year }),
  };
}

/** The open world's calendar, and how to write a date in it. */
export function useCalendar(): {
  calendar: WorldCalendar;
  format: (days: number, precision: DatePrecision) => string;
} {
  const { data: world } = useCurrentWorld();
  const words = useCalendarWords();
  const calendar = world?.calendar ?? DEFAULT_CALENDAR;
  return {
    calendar,
    format: (days, precision) => formatDate(calendar, days, precision, words),
  };
}
