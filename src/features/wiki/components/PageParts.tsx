import { Link, useParams } from "@tanstack/react-router";
import { EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { WIKI_BUTTON } from "./styles";

/** A document without a page in the wiki (hidden since, or never shown). */
export function NotInWiki({ message }: { message: string }) {
  const { t } = useTranslation();
  const { worldId } = useParams({ from: "/world/$worldId" });
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <EyeOff aria-hidden className="size-8 text-wiki-muted" />
      <p className="font-wiki-heading text-lg font-bold">{message}</p>
      <Link to="/world/$worldId/wiki" params={{ worldId }} className={WIKI_BUTTON}>
        {t("wiki.page.home")}
      </Link>
    </div>
  );
}
