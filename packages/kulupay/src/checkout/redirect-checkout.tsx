"use client";

import { useState, useEffect } from "react";
import type { CheckoutProps } from "./types";
import { formatAmount } from "./types";

export function RedirectCheckout({ intent, onStartPolling }: CheckoutProps) {
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const providerName = intent.providerId.includes("stripe")
    ? "Stripe"
    : intent.providerId.includes("chapa")
    ? "Chapa"
    : intent.providerId.includes("paypal")
    ? "PayPal"
    : intent.providerId;

  const redirectUrl = intent.raw?.redirectUrl || intent.metadata?.redirectUrl || intent.raw?.url;

  useEffect(() => {
    if (intent.status === "processing" && redirectUrl) {
      onStartPolling();
    }
  }, [intent.status, redirectUrl, onStartPolling]);

  const handleRedirect = () => {
    if (!redirectUrl) {
      setError("No redirect URL available. Please contact the merchant.");
      return;
    }
    setRedirecting(true);
    window.location.href = redirectUrl;
  };

  if (intent.status === "processing") {
    return (
      <div style={{ textAlign: "center", padding: 24 }}>
        <div style={{ width: 32, height: 32, border: "3px solid #333", borderTopColor: "#fafafa", borderRadius: "50%", margin: "0 auto 16px" }} />
        <p style={{ color: "#888", fontSize: 14 }}>Waiting for {providerName} confirmation...</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 16, padding: 12, background: "#1a1a1a", borderRadius: 8, fontSize: 13 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "#888" }}>Provider</span>
          <span style={{ fontWeight: 600 }}>{providerName}</span>
        </div>
      </div>

      <button
        onClick={handleRedirect}
        disabled={redirecting}
        style={{
          width: "100%",
          padding: "14px 24px",
          borderRadius: 10,
          border: "none",
          background: redirecting ? "#333" : "#fafafa",
          color: redirecting ? "#888" : "#0a0a0a",
          fontSize: 16,
          fontWeight: 600,
          cursor: redirecting ? "not-allowed" : "pointer",
        }}
      >
        {redirecting ? "Redirecting..." : `Pay ${formatAmount(intent.amount, intent.currency)} with ${providerName}`}
      </button>

      {error && (
        <div style={{ marginTop: 16, padding: 12, background: "#2a0d0d", borderRadius: 8, border: "1px solid #5a1a1a", fontSize: 13, color: "#ff6b6b" }}>
          {error}
        </div>
      )}
      <p style={{ marginTop: 16, fontSize: 11, color: "#555" }}>You will be redirected to {providerName} to complete your payment.</p>
    </div>
  );
}
