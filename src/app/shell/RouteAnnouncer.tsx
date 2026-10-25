import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

/** The page's own title: its first heading outside any dialog. */
function pageHeading(): HTMLElement | null {
  for (const heading of document.querySelectorAll<HTMLElement>("main h1, h1")) {
    if (!heading.closest("[role=dialog]")) return heading;
  }
  return null;
}

/**
 * After each navigation (V2-2.6): screen readers hear the new page's title,
 * the window takes it as its title, and when the focus was lost (the button
 * clicked is gone, as when leaving a world) it is put on that title rather
 * than left on the document's body.
 */
export function RouteAnnouncer() {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const previous = useRef<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const first = previous.current === null;
    previous.current = pathname;
    let frame = 0;
    // Two frames: the new page has rendered its heading.
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        const heading = pageHeading();
        const title = heading?.textContent?.trim() ?? "";
        document.title = title ? t("shell.pageTitle", { title }) : t("shell.appName");
        if (first) return;
        setMessage(title ? t("shell.pageAnnounce", { title }) : "");
        const lost = !document.activeElement || document.activeElement === document.body;
        if (lost && heading) {
          if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
          heading.focus({ preventScroll: true });
        }
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname, t]);

  return (
    <div role="status" aria-live="polite" className="sr-only">
      {message}
    </div>
  );
}
