"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { CheckoutIntentData, PayClientLike } from "./types";
import { getProviderType, formatAmount } from "./types";
import { KuluPayCheckout } from "./appkit-checkout";
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
          <p style={{ color: "#a1a1aa", fontSize: 15 }}>Loading checkout...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={centerStyle}>
        <div style={{ ...cardStyle, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: "#fafafa" }}>Checkout Error</h1>
          <p style={{ color: "#a1a1aa", fontSize: 14, lineHeight: 1.5 }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!intent) return null;

  if (intent.status === "succeeded") {
    return (
      <div style={centerStyle}>
        <div style={{ ...cardStyle, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16, color: "#22c55e" }}>✓</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: "#fafafa" }}>Payment Succeeded</h1>
          <p style={{ color: "#a1a1aa", fontSize: 15 }}>{formatAmount(intent.amount, intent.currency)} paid via {intent.providerId}</p>
          {intent.txHash && (
            <p style={{ color: "#71717a", fontSize: 12, marginTop: 12, wordBreak: "break-all", fontFamily: "monospace" }}>
              TX: {intent.txHash}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (intent.status === "expired") {
    return (
      <div style={centerStyle}>
        <div style={{ ...cardStyle, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏰</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: "#fafafa" }}>Payment Expired</h1>
          <p style={{ color: "#a1a1aa", fontSize: 14, lineHeight: 1.5 }}>This payment link has expired. Please create a new one.</p>
        </div>
      </div>
    );
  }

  const providerType = getProviderType(intent.providerId, intent.checkoutFlow);
  const isOnchain = providerType === "evm" || providerType === "tron";
  const sharedProps = {
    intent,
    client,
    onStartPolling: startPolling,
    onUpdateStatus: (status: string, txHash?: string) => {
      setIntent((prev) => (prev ? { ...prev, status, txHash: txHash || prev.txHash } : prev));
    },
  };

  return (
    <div style={centerStyle}>
      <div style={cardStyle}>
        <div style={{ marginBottom: 24, paddingBottom: 20, borderBottom: "1px solid #27272a" }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: "#fafafa" }}>
            Pay {formatAmount(intent.amount, intent.currency)}
          </h1>
          {intent.description && <p style={{ fontSize: 14, color: "#a1a1aa" }}>{intent.description}</p>}
        </div>

        {isOnchain && (
          <KuluPayCheckout
            intent={intent}
            client={client as any}
            onStatusChange={(status, txHash) => {
              setIntent((prev) => (prev ? { ...prev, status, txHash: txHash || prev.txHash } : prev));
              if (status === "pending_confirmation") startPolling();
            }}
            onConfirmed={() => {
              setIntent((prev) => (prev ? { ...prev, status: "succeeded" } : prev));
            }}
          />
        )}
        {providerType === "redirect" && <RedirectCheckout {...sharedProps} />}
        {providerType === "unknown" && (
          <div style={{ textAlign: "center", padding: 24 }}>
            <p style={{ color: "#888" }}>Unknown provider: {intent.providerId}</p>
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
  background: "#09090b",
  padding: 16,
};

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 440,
  background: "#18181b",
  borderRadius: 16,
  border: "1px solid #27272a",
  padding: 28,
  boxShadow: "0 0 0 1px rgba(255,255,255,0.02), 0 8px 32px rgba(0,0,0,0.4)",
};

const spinnerStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  border: "3px solid #27272a",
  borderTopColor: "#fafafa",
  borderRadius: "50%",
  margin: "0 auto 16px",
};
