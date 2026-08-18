"use client";

import { useMemo, useState, useEffect } from "react";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { payClient } from "@/lib/pay-client";

const KuluPayAppKitProvider = dynamic(
  () => import("@kulupay/kulupay/appkit/react").then((m) => m.KuluPayAppKitProvider),
  { ssr: false }
);

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = useMemo(() => new QueryClient(), []);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </ThemeProvider>
    );
  }

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
