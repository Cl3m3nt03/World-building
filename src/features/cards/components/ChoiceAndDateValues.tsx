import { CalendarDays, ChevronDown, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSetPropertyValue } from "@/features/properties";
import { DateField, type DateValue } from "@/features/timelines/components/DateField";
import { useCalendar } from "@/features/timelines/useCalendar";
import type { CardProperty } from "@/lib/bindings";
import { usePendingSave } from "@/lib/pendingSaves";
import { cn } from "@/lib/utils";

type FieldProps = { cardId: string; property: CardProperty; inputId: string };

/** Where the date field starts for a card without a date. */
const NO_DATE: DateValue = { days: 0, precision: "year" };

/**
 * A « select » value: the chosen choices as chips, and a menu to pick. The
 * menu stays open to tick several when the property allows it.
 */
export function ChoiceValue({ cardId, property }: FieldProps) {
  const { t } = useTranslation();
  const setValue = useSetPropertyValue(cardId);
  const { definition } = property;
  const ids = property.value?.kind === "select" ? property.value.value : [];
  const chosen = definition.options.filter((option) => ids.includes(option.id));

  const save = (next: string[]) =>
    setValue.mutate({
      propertyId: definition.id,
      value: next.length === 0 ? null : { kind: "select", value: next },
    });

  return (
    <div className="flex flex-col gap-1">
      <ul aria-label={definition.label} className="flex flex-wrap items-center gap-1.5">
        {chosen.map((option) => (
          <li
            key={option.id}
            className="flex items-center gap-1 rounded-full bg-secondary py-0.5 pr-0.5 pl-2.5 text-sm"
          >
            {option.label}
            <Button
              variant="ghost"
              size="icon-xs"
              className="rounded-full"
              aria-label={t("properties.removeChoice", { name: option.label })}
              onClick={() => save(ids.filter((id) => id !== option.id))}
            >
              <X />
            </Button>
          </li>
        ))}
        <li>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                aria-label={t("properties.chooseFor", { name: definition.label })}
                // A chosen value reads alone at rest: the row's hover or focus
                // brings its menu back.
                className={cn(
                  "text-muted-foreground aria-expanded:opacity-100",
                  chosen.length > 0 &&
                    "opacity-0 group-focus-within/property:opacity-100 group-hover/property:opacity-100 focus-visible:opacity-100",
                )}
              >
                {definition.multiple || chosen.length === 0
                  ? t("properties.chooseOption")
                  : t("properties.changeOption")}
                <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-72 w-56 overflow-y-auto">
              {definition.options.length === 0 && (
                <DropdownMenuItem disabled>{t("properties.noOptions")}</DropdownMenuItem>
              )}
              {definition.multiple ? (
                definition.options.map((option) => (
                  <DropdownMenuCheckboxItem
                    key={option.id}
                    checked={ids.includes(option.id)}
                    onSelect={(event) => event.preventDefault()}
                    onCheckedChange={(checked) =>
                      save(checked ? [...ids, option.id] : ids.filter((id) => id !== option.id))
                    }
                  >
                    {option.label}
                  </DropdownMenuCheckboxItem>
                ))
              ) : (
                <DropdownMenuRadioGroup
                  value={ids.length === 1 ? (ids[0] ?? "") : ""}
                  onValueChange={(id) => save([id])}
                >
                  {definition.options.map((option) => (
                    <DropdownMenuRadioItem key={option.id} value={option.id}>
                      {option.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </li>
      </ul>
      {setValue.isError && <AppErrorMessage error={setValue.error} />}
    </div>
  );
}

/**
 * A « date » value: the date written in the world's calendar. A click opens
 * the timelines' date field; the date is saved when the window closes.
 */
export function DateValueField({ cardId, property, inputId }: FieldProps) {
  const { t } = useTranslation();
  const { calendar, format } = useCalendar();
  const setValue = useSetPropertyValue(cardId);
  const { definition } = property;
  const saved = property.value?.kind === "date" ? property.value.value : null;
  const [open, setOpen] = useState(false);
  // What was changed in the window and not saved yet.
  const [draft, setDraft] = useState<DateValue | null>(null);
  const written = saved ? format(saved.days, saved.precision) : null;

  const save = (value: DateValue | null) => {
    setDraft(null);
    if (!value) return undefined;
    // A failure is shown under the field (`setValue.error`).
    return setValue
      .mutateAsync({ propertyId: definition.id, value: { kind: "date", value } })
      .catch(() => {});
  };
  usePendingSave(() => save(draft));

  const finish = () => {
    // « OK » on an empty field means the date it shows.
    void save(draft ?? (saved ? null : NO_DATE));
    setOpen(false);
  };

  const clear = () => {
    setDraft(null);
    setOpen(false);
    setValue.mutate({ propertyId: definition.id, value: null });
  };

  return (
    <div className="flex flex-col gap-1">
      <Popover
        open={open}
        onOpenChange={(next) => {
          if (!next) void save(draft);
          setOpen(next);
        }}
      >
        <PopoverTrigger asChild>
          <Button
            id={inputId}
            variant="ghost"
            size="sm"
            className="h-7 justify-start border-transparent px-1.5 font-normal hover:border-border hover:bg-(--bz-field) aria-expanded:border-border aria-expanded:bg-(--bz-field)"
            aria-label={t("properties.dateOf", {
              name: definition.label,
              value: written ?? t("properties.noDate"),
            })}
          >
            <CalendarDays className="text-muted-foreground" />
            <span className={written ? "truncate" : "truncate text-muted-foreground"}>
              {written ?? t("properties.chooseDate")}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="glass flex w-[26rem] max-w-[90vw] flex-col gap-3">
          {/* biome-ignore lint/a11y/noStaticElementInteractions: Enter in a field confirms */}
          <div
            onKeyDown={(event) => {
              if (event.key === "Enter" && event.target instanceof HTMLInputElement) finish();
            }}
          >
            <DateField
              legend={definition.label}
              calendar={calendar}
              value={draft ?? saved ?? NO_DATE}
              onChange={setDraft}
            />
          </div>
          <div className="flex justify-end gap-2">
            {saved && (
              <Button variant="ghost" size="sm" onClick={clear}>
                {t("properties.dateClear")}
              </Button>
            )}
            <Button size="sm" onClick={finish}>
              {t("properties.dateDone")}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      {setValue.isError && <AppErrorMessage error={setValue.error} />}
    </div>
  );
}
