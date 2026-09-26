import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { useState } from "react";
import { ErrorBoundary } from "@/app/ErrorScreen";
import { createAppRouter } from "@/app/router";
import { useThemeSync } from "@/app/theme";
import { TooltipProvider } from "@/components/ui/tooltip";
import { usePreferencesSync } from "@/features/settings";
import { createQueryClient } from "@/lib/query";

function Providers() {
  const [queryClient] = useState(createQueryClient);
  const [router] = useState(() => createAppRouter());
  useThemeSync();
  usePreferencesSync();

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>
        <RouterProvider router={router} />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <Providers />
    </ErrorBoundary>
  );
}
