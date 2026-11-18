import { cn } from "cn";
import { XIcon } from "lucide-react";
import { Toast as ToastPrimitive } from "radix-ui";
import type * as React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

/** Notifications (#604), on Radix Toast: announced, paused on hover and focus, F8 to reach them. */
function ToastProvider({ ...props }: React.ComponentProps<typeof ToastPrimitive.Provider>) {
  return <ToastPrimitive.Provider data-slot="toast-provider" {...props} />;
}

function ToastViewport({
  className,
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Viewport>) {
  return (
    <ToastPrimitive.Viewport
      data-slot="toast-viewport"
      className={cn(
        "fixed bottom-4 left-1/2 z-[100] m-0 flex w-max max-w-[calc(100%-2rem)] -translate-x-1/2 list-none flex-col items-center gap-2 p-0 outline-none",
        className,
      )}
      {...props}
    />
  );
}

function Toast({ className, ...props }: React.ComponentProps<typeof ToastPrimitive.Root>) {
  return (
    <ToastPrimitive.Root
      data-slot="toast"
      className={cn(
        "glass-float flex max-w-full items-center gap-3 rounded-lg py-1.5 pr-1.5 pl-3 text-sm text-popover-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 duration-(--bz-duration-base) ease-atlas data-[state=closed]:duration-(--bz-duration-fast) data-[state=closed]:ease-atlas-in data-[swipe=move]:translate-y-(--radix-toast-swipe-move-y) data-[swipe=cancel]:translate-y-0 data-[swipe=end]:animate-out data-[swipe=end]:fade-out-0",
        className,
      )}
      {...props}
    />
  );
}

function ToastTitle({ className, ...props }: React.ComponentProps<typeof ToastPrimitive.Title>) {
  return (
    <ToastPrimitive.Title
      data-slot="toast-title"
      className={cn("min-w-0 truncate", className)}
      {...props}
    />
  );
}

function ToastAction({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Action>) {
  return (
    <ToastPrimitive.Action data-slot="toast-action" asChild {...props}>
      <Button variant="outline" size="sm" className={className}>
        {children}
      </Button>
    </ToastPrimitive.Action>
  );
}

function ToastClose({ className, ...props }: React.ComponentProps<typeof ToastPrimitive.Close>) {
  const { t } = useTranslation();
  return (
    <ToastPrimitive.Close data-slot="toast-close" asChild {...props}>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("common.close")}
        className={cn("text-muted-foreground", className)}
      >
        <XIcon />
      </Button>
    </ToastPrimitive.Close>
  );
}

export { Toast, ToastAction, ToastClose, ToastProvider, ToastTitle, ToastViewport };
