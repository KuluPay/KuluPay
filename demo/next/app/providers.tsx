"use client";

import { useMemo } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { KuluPayAppKitProvider } from "@kulupay/kulupay/appkit/react";
import { payClient } from "@/lib/pay-client";

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = useMemo(() => new QueryClient(), []);

  return (
    <QueryClientProvider client={queryClient}>
      <KuluPayAppKitProvider
        client={payClient}
        themeOptions={{
          themeMode: "dark",
          themeVariables: {
            "--w3m-accent": "#6366f1",
            "--w3m-background": "#0a0a0f",
            "--w3m-border-radius-master": "14px",
            "--w3m-font-family": "system-ui, -apple-system, sans-serif",
          },
          featuredWallets: ["metamask", "coinbase", "rainbow", "okx", "trust"],
        }}
      >
        {children}
      </KuluPayAppKitProvider>
    </QueryClientProvider>
  );
}
