import { Check, ImagePlus, X } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppErrorMessage } from "@/components/AppErrorMessage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ImagePickerDialog } from "@/features/media";
import type { BookFinish, BookStyle, Cover, TitlePosition } from "@/lib/bindings";
import { cn } from "@/lib/utils";
import { Book3D } from "../cover/Book3D";
import { BOOK_COLORS } from "./BookCover";

export type StoryFormValue = { title: string; bookStyle: BookStyle; cover: Cover };

export const DEFAULT_STORY: StoryFormValue = {
  title: "",
  bookStyle: { color: BOOK_COLORS[0], finish: "cloth" },
  cover: { assetId: null, titlePosition: "middle" },
};

const FINISHES: BookFinish[] = ["cloth", "leather", "paper"];
const POSITIONS: TitlePosition[] = ["top", "middle", "bottom"];

type Props = {
  initial: StoryFormValue;
  /** "create": a new story; "edit": an existing one's book. */
  mode: "create" | "edit";
  pending: boolean;
  error: unknown;
  onSubmit: (value: StoryFormValue) => void;
  onCancel: () => void;
};

/**
 * The book of a story (docs/features/08-quill.md): its title, its colour and
 * finish, its cover image and where the title sits, with the book previewed
 * as it changes.
 */
export function StoryForm({ initial, mode, pending, error, onSubmit, onCancel }: Props) {
  const { t } = useTranslation();
  const [value, setValue] = useState(initial);
  const [picking, setPicking] = useState(false);
  const titleId = useId();
  const colorId = useId();
  const valid = value.title.trim() !== "";
  const set = (change: Partial<StoryFormValue>) =>
    setValue((current) => ({ ...current, ...change }));
  const setStyle = (change: Partial<BookStyle>) =>
    set({ bookStyle: { ...value.bookStyle, ...change } });
  const setCover = (change: Partial<Cover>) => set({ cover: { ...value.cover, ...change } });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (valid) onSubmit({ ...value, title: value.title.trim() });
  };

  return (
    <form
      onSubmit={submit}
      aria-label={t(mode === "create" ? "quill.form.createTitle" : "quill.form.editTitle")}
      className="glass mx-auto grid h-full max-w-4xl gap-8 overflow-y-auto rounded-lg p-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
    >
      <div className="flex items-center justify-center">
        <Book3D
          title={value.title.trim() || t("quill.form.titlePlaceholder")}
          bookStyle={value.bookStyle}
          cover={value.cover}
          className="w-full max-w-80"
        />
      </div>
      <div className="flex flex-col gap-5">
        <h1 className="font-heading text-2xl font-bold">
          {t(mode === "create" ? "quill.form.createTitle" : "quill.form.editTitle")}
        </h1>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={titleId}>{t("quill.form.title")}</Label>
          <Input
            id={titleId}
            value={value.title}
            maxLength={200}
            placeholder={t("quill.form.titlePlaceholder")}
            onChange={(event) => set({ title: event.target.value })}
            autoFocus
          />
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium">{t("quill.form.color")}</legend>
          <div className="flex flex-wrap items-center gap-2">
            {BOOK_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={t("quill.form.colorValue", { color })}
                aria-pressed={value.bookStyle.color === color}
                onClick={() => setStyle({ color })}
                className="flex size-8 items-center justify-center rounded-full border border-border outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:ring-2 aria-pressed:ring-primary"
                style={{ backgroundColor: color }}
              >
                {value.bookStyle.color === color && (
                  <Check aria-hidden className="size-4 text-white mix-blend-difference" />
                )}
              </button>
            ))}
            <label htmlFor={colorId} className="sr-only">
              {t("quill.form.customColor")}
            </label>
            <input
              id={colorId}
              type="color"
              value={value.bookStyle.color}
              onChange={(event) => setStyle({ color: event.target.value })}
              className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent"
            />
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium">{t("quill.form.finish")}</legend>
          <RadioGroup
            value={value.bookStyle.finish}
            onValueChange={(finish) => setStyle({ finish: finish as BookFinish })}
            className="flex gap-4"
          >
            {FINISHES.map((finish) => (
              <div key={finish} className="flex items-center gap-2">
                <RadioGroupItem value={finish} id={`${colorId}-${finish}`} />
                <Label htmlFor={`${colorId}-${finish}`}>{t(`quill.finish.${finish}`)}</Label>
              </div>
            ))}
          </RadioGroup>
        </fieldset>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium">{t("quill.form.cover")}</legend>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => setPicking(true)}>
              <ImagePlus />
              {t(value.cover.assetId ? "quill.form.changeCover" : "quill.form.chooseCover")}
            </Button>
            {value.cover.assetId && (
              <Button type="button" variant="ghost" onClick={() => setCover({ assetId: null })}>
                <X />
                {t("quill.form.removeCover")}
              </Button>
            )}
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium">{t("quill.form.titlePosition")}</legend>
          <RadioGroup
            value={value.cover.titlePosition}
            onValueChange={(position) => setCover({ titlePosition: position as TitlePosition })}
            className="flex gap-4"
          >
            {POSITIONS.map((position) => (
              <div key={position} className="flex items-center gap-2">
                <RadioGroupItem value={position} id={`${colorId}-${position}`} />
                <Label htmlFor={`${colorId}-${position}`}>{t(`quill.position.${position}`)}</Label>
              </div>
            ))}
          </RadioGroup>
        </fieldset>
        {error ? <AppErrorMessage error={error} /> : null}
        <div className={cn("mt-auto flex justify-end gap-2")}>
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t("quill.cancel")}
          </Button>
          <Button type="submit" disabled={!valid || pending}>
            {t(mode === "create" ? "quill.form.create" : "quill.form.save")}
          </Button>
        </div>
      </div>
      <ImagePickerDialog
        open={picking}
        onOpenChange={setPicking}
        title={t("quill.form.cover")}
        selectedId={value.cover.assetId}
        onPick={(assetId) => setCover({ assetId })}
      />
    </form>
  );
}
