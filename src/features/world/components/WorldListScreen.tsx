import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

/** Temporary id for the demo shell link, until real worlds exist (0.9, 0.11). */
const DEMO_WORLD_ID = "demo";

/**
 * World list (start screen). Placeholder: creating and opening worlds comes
 * with 0.11, which replaces the demo link.
 */
export function WorldListScreen() {
  const { t } = useTranslation();

  return (
    <main className="flex h-full flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-4xl font-bold">{t("worlds.title")}</h1>
      <p className="max-w-md text-center text-sm text-muted-foreground">{t("worlds.empty")}</p>
      <Button asChild variant="secondary" className="rounded-full">
        <Link to="/world/$worldId/home" params={{ worldId: DEMO_WORLD_ID }}>
          {t("worlds.openDemo")}
        </Link>
      </Button>
    </main>
  );
}
