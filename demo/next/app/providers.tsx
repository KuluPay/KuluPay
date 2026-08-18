"use client";

import { useMemo } from "react";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { KuluPayAppKitProvider } from "@kulupay/kulupay/appkit/react";
import { payClient } from "@/lib/pay-client";

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = useMemo(() => new QueryClient(), []);

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <QueryClientProvider client={queryClient}>
        <KuluPayAppKitProvider
          client={payClient}
          themeOptions={{
            themeMode: "dark",
            themeVariables: {
              "--apkt-accent": "#6366f1",
              "--apkt-background": "#0a0a0f",
              "--apkt-border-radius-master": "14px",
              "--apkt-font-family": "system-ui, -apple-system, sans-serif",
            },
          }}
        >
          {children}
        </KuluPayAppKitProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
