"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { CheckoutIntentData, PayClientLike } from "./types";
import { getProviderType, formatAmount, shortenAddress } from "./types";
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
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={spinnerContainerStyle}>
            <div style={spinnerStyle} />
          </div>
          <p style={{ color: "#a1a1aa", fontSize: 14, textAlign: "center", marginTop: 16 }}>Loading checkout...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={iconBadgeStyle}>{errorIconSvg}</div>
          <h1 style={headingStyle}>Checkout Error</h1>
          <p style={subTextStyle}>{error}</p>
        </div>
      </div>
    );
  }

  if (!intent) return null;

  if (intent.status === "succeeded") {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ ...iconBadgeStyle, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" }}>
            {successIconSvg}
          </div>
          <h1 style={headingStyle}>Payment Succeeded</h1>
          <p style={subTextStyle}>
            {formatAmount(intent.amount, intent.currency)} paid via {intent.providerId}
          </p>
          {intent.txHash && (
            <a
              href={`${intent.chainConfig?.explorerUrl ?? ""}/tx/${intent.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              style={txLinkStyle}
            >
              {shortenAddress(intent.txHash, 10)}
              <span style={{ marginLeft: 6, opacity: 0.6 }}>{externalLinkSvg}</span>
            </a>
          )}
        </div>
      </div>
    );
  }

  if (intent.status === "expired") {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ ...iconBadgeStyle, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}>
            {clockIconSvg}
          </div>
          <h1 style={headingStyle}>Payment Expired</h1>
          <p style={subTextStyle}>This payment link has expired. Please create a new one.</p>
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
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={headerStyle}>
          <div style={amountRowStyle}>
            <span style={amountLabelStyle}>Amount</span>
            <span style={amountValueStyle}>{formatAmount(intent.amount, intent.currency)}</span>
          </div>
          {intent.description && <p style={descriptionStyle}>{intent.description}</p>}
          {intent.chainConfig && (
            <div style={chainBadgeStyle}>
              <span style={chainDotStyle} />
              <span>{intent.chainConfig.name}</span>
            </div>
          )}
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

const pageStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "100vh",
  background: "radial-gradient(ellipse at top, #0f0f17 0%, #09090b 60%)",
  padding: 16,
};

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 420,
  background: "linear-gradient(180deg, #16161d 0%, #121217 100%)",
  borderRadius: 20,
  border: "1px solid rgba(255,255,255,0.06)",
  padding: 0,
  boxShadow: "0 0 0 1px rgba(255,255,255,0.02), 0 20px 60px rgba(0,0,0,0.5), 0 0 80px rgba(99,102,241,0.04)",
  overflow: "hidden",
};

const headerStyle: React.CSSProperties = {
  padding: "28px 28px 24px",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
};

const amountRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  marginBottom: 6,
};

const amountLabelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: "#71717a",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const amountValueStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  color: "#fafafa",
  letterSpacing: "-0.02em",
};

const descriptionStyle: React.CSSProperties = {
  fontSize: 14,
  color: "#a1a1aa",
  marginBottom: 12,
};

const chainBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "4px 10px",
  background: "rgba(99,102,241,0.08)",
  border: "1px solid rgba(99,102,241,0.15)",
  borderRadius: 100,
  fontSize: 12,
  fontWeight: 500,
  color: "#a5b4fc",
};

const chainDotStyle: React.CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: "50%",
  background: "#6366f1",
};

const headingStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  marginBottom: 8,
  color: "#fafafa",
  textAlign: "center",
  letterSpacing: "-0.02em",
};

const subTextStyle: React.CSSProperties = {
  color: "#a1a1aa",
  fontSize: 14,
  textAlign: "center",
  lineHeight: 1.5,
};

const iconBadgeStyle: React.CSSProperties = {
  width: 56,
  height: 56,
  borderRadius: 16,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  margin: "0 auto 20px",
  background: "rgba(239,68,68,0.1)",
  border: "1px solid rgba(239,68,68,0.2)",
};

const spinnerContainerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  padding: "32px 0",
};

const spinnerStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  border: "2.5px solid rgba(255,255,255,0.08)",
  borderTopColor: "#6366f1",
  borderRadius: "50%",
  animation: "spin 0.8s linear infinite",
};

const txLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  marginTop: 16,
  padding: "8px 14px",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 10,
  fontSize: 13,
  fontFamily: "monospace",
  color: "#a1a1aa",
  textDecoration: "none",
  transition: "background 0.15s",
};

const successIconSvg = (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const errorIconSvg = (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const clockIconSvg = (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const externalLinkSvg = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);
