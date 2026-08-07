"use client";

import { KuluPayAppKitProvider } from "@kulupay/kulupay/appkit/react";
import { payClient } from "@/lib/pay-client";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
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
        featuredWallets: ["metamask", "coinbase", "rainbow"],
      }}
    >
      {children}
    </KuluPayAppKitProvider>
  );
}
