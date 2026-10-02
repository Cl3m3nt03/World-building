import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Below this, the wait is not worth a dialog (a usual background). */
const SHOW_AFTER_MS = 400;

/**
 * "Preparing the map…" while a map is created or its background changed
 * (M4 step 4.3): a very large image is cut into tiles first, which can take
 * a few seconds. Shown only when the wait lasts, and cannot be dismissed.
 */
export function PreparingMapDialog({ pending }: { pending: boolean }) {
  const { t } = useTranslation();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!pending) {
      setShown(false);
      return;
    }
    const timer = setTimeout(() => setShown(true), SHOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [pending]);

  return (
    <Dialog open={shown}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        className="sm:max-w-sm"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
            {t("maps.preparing.title")}
          </DialogTitle>
          <DialogDescription>{t("maps.preparing.description")}</DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
