"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { CheckoutIntentData, PayClientLike } from "./types";
import { formatAmount } from "./types";
import { EVMCheckout } from "./evm-checkout";
import { TronCheckout } from "./tron-checkout";
import { RedirectCheckout } from "./redirect-checkout";

export interface CheckoutPageProps {
  intentId: string;
  clientSecret: string;
  client: PayClientLike;
}

export function CheckoutPage({ intentId, clientSecret, client }: CheckoutPageProps) {
  const [intent, setIntent] = useState<CheckoutIntentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchIntent = useCallback(async () => {
    const { data, error } = await client.checkoutIntent({ intentId, clientSecret });
    if (error) throw new Error(error.message || "Failed to load payment");
    return data as CheckoutIntentData;
  }, [intentId, clientSecret, client]);

  useEffect(() => {
    fetchIntent()
      .then((data) => {
        setIntent(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load checkout");
        setLoading(false);
      });
  }, [fetchIntent]);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;

    pollRef.current = setInterval(async () => {
      try {
        const { data, error } = await client.verifyIntent({ intentId, clientSecret });
        if (error || !data) return;

        if (data.status === "succeeded" || data.status === "failed" || data.status === "expired") {
          setIntent((prev) => (prev ? { ...prev, status: data.status, txHash: data.txHash || prev.txHash } : prev));
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        } else if (data.status === "pending_confirmation") {
          setIntent((prev) => (prev ? { ...prev, status: data.status, txHash: data.txHash || prev.txHash } : prev));
        }
      } catch {
        // retry on next poll
      }
    }, 5000);
  }, [intentId, clientSecret, client]);

  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []);

  if (loading) {
    return (
      <div style={centerStyle}>
        <div style={{ textAlign: "center" }}>
          <div style={spinnerStyle} />
          <p style={{ color: "#888" }}>Loading checkout...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={centerStyle}>
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Checkout Error</h1>
          <p style={{ color: "#888" }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!intent) return null;

  if (intent.status === "succeeded") {
    return (
      <div style={centerStyle}>
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Payment Succeeded</h1>
          <p style={{ color: "#888", fontSize: 14 }}>{formatAmount(intent.amount, intent.currency)} paid via {intent.providerId}</p>
          {intent.txHash && <p style={{ color: "#555", fontSize: 12, marginTop: 8, wordBreak: "break-all" }}>TX: {intent.txHash}</p>}
        </div>
      </div>
    );
  }

  if (intent.status === "expired") {
    return (
      <div style={centerStyle}>
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏰</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Payment Expired</h1>
          <p style={{ color: "#888", fontSize: 14 }}>This payment link has expired. Please create a new one.</p>
        </div>
      </div>
    );
  }

  const flow = intent.checkoutFlow || "none";
  const isEVM = intent.raw?.family === "evm" || intent.metadata?.family === "evm";
  const sharedProps = {
    intent,
    client,
    onStartPolling: startPolling,
    onUpdateStatus: (status: string, txHash?: string) => {
      setIntent((prev) => (prev ? { ...prev, status, txHash: txHash || prev.txHash } : prev));
    },
  };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 420, background: "#141414", borderRadius: 16, border: "1px solid #262626", padding: 24 }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Pay {formatAmount(intent.amount, intent.currency)}</h1>
          {intent.description && <p style={{ fontSize: 14, color: "#888" }}>{intent.description}</p>}
        </div>

        {flow === "self-hosted" && isEVM && <EVMCheckout {...sharedProps} />}
        {flow === "self-hosted" && !isEVM && <TronCheckout {...sharedProps} />}
        {flow === "redirect" && <RedirectCheckout {...sharedProps} />}
        {flow === "embedded" && (
          <div style={{ textAlign: "center", padding: 24 }}>
            <p style={{ color: "#888" }}>Embedded checkout not yet supported for {intent.providerId}</p>
          </div>
        )}
        {flow === "none" && (
          <div style={{ textAlign: "center", padding: 24 }}>
            <p style={{ color: "#888" }}>No checkout UI available for {intent.providerId}</p>
          </div>
        )}
      </div>
    </div>
  );
}

const centerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "100vh",
};

const spinnerStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  border: "3px solid #333",
  borderTopColor: "#fafafa",
  borderRadius: "50%",
  margin: "0 auto 16px",
};
