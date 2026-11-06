import { useTranslation } from "react-i18next";
import emblem from "@/assets/brand/emblem.png";
import { cn } from "@/lib/utils";

/**
 * The app's emblem (a compass rose over an open book, from assets/brand).
 * Its gold and navy read on both themes, so one image serves both.
 */
export function BrandEmblem({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <img
      src={emblem}
      alt={t("brand.emblemAlt")}
      draggable={false}
      className={cn("select-none object-contain", className)}
    />
  );
}
