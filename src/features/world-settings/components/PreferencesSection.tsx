import { TriangleAlert } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { WorldInfo } from "@/lib/bindings";
import { DeleteWorldDialog } from "./DeleteWorldDialog";

/** "Preferences" section of the world settings, ending with the danger zone. */
export function PreferencesSection({ world }: { world: WorldInfo }) {
  const { t } = useTranslation();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const dangerId = useId();

  return (
    <div className="flex flex-col gap-5">
      <section
        aria-labelledby={dangerId}
        className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4"
      >
        <TriangleAlert aria-hidden className="size-5 shrink-0 text-destructive" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 id={dangerId} className="text-sm font-semibold">
            {t("worldSettings.danger.title")}
          </h3>
          <p className="text-sm text-muted-foreground">{t("worldSettings.danger.description")}</p>
        </div>
        <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
          {t("worldSettings.danger.deleteWorld")}
        </Button>
      </section>
      <DeleteWorldDialog world={world} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </div>
  );
}
