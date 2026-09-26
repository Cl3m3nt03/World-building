import { TriangleAlert } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? `${error.name}: ${error.message}`;
  }
  return String(error);
}

function goToWorldList(): void {
  window.location.hash = "/";
  window.location.reload();
}

/**
 * Full-screen error page shown instead of a blank window. It only relies on
 * i18n and plain navigation, so it still works when the router itself failed.
 */
export function ErrorScreen({ error }: { error: unknown }) {
  const { t } = useTranslation();

  return (
    <div
      role="alert"
      className="flex h-screen w-screen items-center justify-center bg-background p-6"
    >
      <div className="glass flex w-full max-w-lg flex-col gap-4 rounded-lg p-6">
        <div className="flex items-center gap-3">
          <TriangleAlert aria-hidden className="size-6 text-destructive" />
          <h1 className="text-xl font-bold">{t("error.title")}</h1>
        </div>
        <p className="text-sm text-muted-foreground">{t("error.description")}</p>
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none">{t("error.details")}</summary>
          <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-muted p-3 font-mono whitespace-pre-wrap">
            {errorMessage(error)}
          </pre>
        </details>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={goToWorldList}>
            {t("error.backToWorlds")}
          </Button>
          <Button onClick={() => window.location.reload()}>{t("error.reload")}</Button>
        </div>
      </div>
    </div>
  );
}

export function NotFoundScreen() {
  const { t } = useTranslation();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      <h1 className="text-2xl font-bold">{t("notFound.title")}</h1>
      <p className="text-sm text-muted-foreground">{t("notFound.description")}</p>
      <Button variant="secondary" onClick={goToWorldList}>
        {t("error.backToWorlds")}
      </Button>
    </div>
  );
}

type ErrorBoundaryProps = { children: ReactNode };
type ErrorBoundaryState = { error: unknown; hasError: boolean };

/**
 * Global error boundary, around the whole app. Route render errors are caught
 * earlier by the router (defaultErrorComponent), which shows the same screen.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null, hasError: false };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error, hasError: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    // Visible in the WebView devtools. Forwarding front errors to the Rust
    // log file needs a dedicated command, not part of 0.8.
    console.error("Unhandled render error", error, info.componentStack);
  }

  override render() {
    if (this.state.hasError) {
      return <ErrorScreen error={this.state.error} />;
    }
    return this.props.children;
  }
}
