"use client";

import { KuluPayAppKitProvider } from "@kulupay/kulupay/appkit/react";
import { payClient } from "@/lib/pay-client";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <KuluPayAppKitProvider client={payClient}>
      {children}
    </KuluPayAppKitProvider>
  );
}
