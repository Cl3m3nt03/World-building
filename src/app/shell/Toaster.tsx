import { CircleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { type Toast as ToastData, useToasts } from "@/app/stores/toasts";
import {
  Toast,
  ToastAction,
  ToastClose,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

/** How long a notification stays (ms); hovering or focusing it pauses it. */
export const TOAST_DURATION = 8000;
/** Time left to a closed notification to fade out before it is dropped. */
const EXIT_MS = 1000;

function ToastItem({ toast }: { toast: ToastData }) {
  const dismiss = useToasts((state) => state.dismiss);
  const [open, setOpen] = useState(true);
  return (
    <Toast
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) window.setTimeout(() => dismiss(toast.id), EXIT_MS);
      }}
      // The result of what the user just did: announced politely, after
      // what is being read (the page they land on, for one).
      type="background"
      data-tone={toast.tone}
    >
      {toast.tone === "error" && (
        <CircleAlert aria-hidden className="size-4 shrink-0 text-destructive" />
      )}
      <ToastTitle>{toast.message}</ToastTitle>
      {toast.action && (
        <ToastAction altText={toast.action.altText} onClick={toast.action.run}>
          {toast.action.label}
        </ToastAction>
      )}
      <ToastClose />
    </Toast>
  );
}

/**
 * The open world's notifications (#604), at the bottom of the window. F8
 * reaches them from anywhere, Tab goes to their buttons. They go with the
 * world: an undo cannot outlive it.
 */
export function Toaster() {
  const { t } = useTranslation();
  const toasts = useToasts((state) => state.toasts);
  const clear = useToasts((state) => state.clear);
  useEffect(() => clear, [clear]);

  return (
    <ToastProvider duration={TOAST_DURATION} swipeDirection="down" label={t("toast.label")}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
      <ToastViewport label={t("toast.viewport")} />
    </ToastProvider>
  );
}
