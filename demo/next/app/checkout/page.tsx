"use client";

import { use, Suspense } from "react";
import { CheckoutPage } from "@kulupay/kulupay/checkout/react";
import { payClient } from "@/lib/pay-client";

function CheckoutContent({ searchParams }: { searchParams: Promise<{ intentId?: string; clientSecret?: string }> }) {
  const params = use(searchParams);
  const intentId = params.intentId;
  const clientSecret = params.clientSecret;

  if (!intentId || !clientSecret) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#0a0a0a" }}>
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: "#fafafa" }}>Missing Parameters</h1>
          <p style={{ color: "#888", fontSize: 14 }}>Need both <code>intentId</code> and <code>clientSecret</code> query params.</p>
        </div>
      </div>
    );
  }

  return (
    <CheckoutPage
      intentId={intentId}
      clientSecret={clientSecret}
      client={payClient as any}
    />
  );
}

export default function CheckoutRoute({ searchParams }: { searchParams: Promise<{ intentId?: string; clientSecret?: string }> }) {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#0a0a0a" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 32, height: 32, border: "3px solid #333", borderTopColor: "#fafafa", borderRadius: "50%", margin: "0 auto 16px" }} />
          <p style={{ color: "#888" }}>Loading...</p>
        </div>
      </div>
    }>
      <CheckoutContent searchParams={searchParams} />
    </Suspense>
  );
}
