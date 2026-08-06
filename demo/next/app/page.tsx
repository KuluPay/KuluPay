"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { payClient } from "@/lib/pay-client";

export default function Home() {
  const router = useRouter();
  const [amount, setAmount] = useState("10.00");
  const [currency, setCurrency] = useState("USD");
  const [providerId, setProviderId] = useState("ethereum-usdc");
  const [description, setDescription] = useState("Test payment");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePay = async () => {
    setError(null);
    setLoading(true);

    try {
      const cents = Math.round(parseFloat(amount) * 100);
      if (!cents || cents <= 0) {
        setError("Enter a valid amount");
        setLoading(false);
        return;
      }

      const [chain, token] = providerId.split("-");
      const result = await payClient.createIntent({
        body: {
          amount: cents,
          currency: currency.toLowerCase(),
          providerId: chain,
          token: token?.toUpperCase(),
          description,
          type: "one_time",
        },
      });

      console.log("createIntent result:", JSON.stringify(result, null, 2));
      console.log("result keys:", Object.keys(result || {}));
      console.log("result.data:", result?.data);
      console.log("result.data keys:", result?.data ? Object.keys(result.data) : "no data");
      console.log("result.error:", result?.error);

      if (result?.data?.id && result?.data?.clientSecret) {
        router.push(`/checkout?intentId=${result.data.id}&clientSecret=${result.data.clientSecret}`);
      } else {
        const detail = result?.error?.message || `Missing id or clientSecret in response`;
        setError(`Failed: ${detail}`);
      }
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>KuluPay Demo</h1>
        <p style={subtitleStyle}>Create a payment intent and test the checkout flow.</p>

        <div style={fieldStyle}>
          <label style={labelStyle}>Amount</label>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={inputStyle}
            placeholder="10.00"
          />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Currency</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            style={inputStyle}
          >
            <option value="USD">USD</option>
            <option value="ETB">ETB (Birr)</option>
          </select>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Provider</label>
          <select
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
            style={inputStyle}
          >
            <optgroup label="Ethereum">
              <option value="ethereum-usdc">Ethereum (USDC)</option>
              <option value="ethereum-usdt">Ethereum (USDT)</option>
            </optgroup>
            <optgroup label="Base">
              <option value="base-usdc">Base (USDC)</option>
              <option value="base-usdt">Base (USDT)</option>
            </optgroup>
            <optgroup label="Polygon">
              <option value="polygon-usdc">Polygon (USDC)</option>
              <option value="polygon-usdt">Polygon (USDT)</option>
            </optgroup>
            <optgroup label="Arbitrum">
              <option value="arbitrum-usdc">Arbitrum (USDC)</option>
              <option value="arbitrum-usdt">Arbitrum (USDT)</option>
            </optgroup>
            <optgroup label="Tron">
              <option value="tron-usdt">Tron (USDT)</option>
            </optgroup>
          </select>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={inputStyle}
            placeholder="Test payment"
          />
        </div>

        {error && <div style={errorBoxStyle}>{error}</div>}

        <button
          onClick={handlePay}
          disabled={loading}
          style={buttonStyle(loading)}
        >
          {loading ? "Creating..." : `Pay ${amount} ${currency}`}
        </button>

        <div style={footerStyle}>
          <p>API: <code style={codeStyle}>POST /api/pay/create-intent</code></p>
          <p>Checkout: <code style={codeStyle}>/checkout?intentId=...&clientSecret=...</code></p>
        </div>
      </div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "100vh",
  background: "#0a0a0a",
  padding: 16,
};

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 400,
  background: "#141414",
  borderRadius: 16,
  border: "1px solid #262626",
  padding: 32,
};

const titleStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  marginBottom: 4,
  color: "#fafafa",
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 14,
  color: "#888",
  marginBottom: 24,
};

const fieldStyle: React.CSSProperties = {
  marginBottom: 16,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 500,
  marginBottom: 6,
  color: "#aaa",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #333",
  background: "#0a0a0a",
  color: "#fafafa",
  fontSize: 14,
  outline: "none",
};

const buttonStyle = (disabled: boolean): React.CSSProperties => ({
  width: "100%",
  padding: "14px 24px",
  borderRadius: 10,
  border: "none",
  background: disabled ? "#333" : "#fafafa",
  color: disabled ? "#888" : "#0a0a0a",
  fontSize: 16,
  fontWeight: 600,
  cursor: disabled ? "not-allowed" : "pointer",
  marginTop: 8,
});

const errorBoxStyle: React.CSSProperties = {
  padding: 12,
  background: "#2a0d0d",
  borderRadius: 8,
  border: "1px solid #5a1a1a",
  fontSize: 13,
  color: "#ff6b6b",
  marginBottom: 16,
};

const footerStyle: React.CSSProperties = {
  marginTop: 24,
  paddingTop: 16,
  borderTop: "1px solid #262626",
  fontSize: 12,
  color: "#666",
};

const codeStyle: React.CSSProperties = {
  fontFamily: "monospace",
  fontSize: 11,
  background: "#1a1a1a",
  padding: "2px 6px",
  borderRadius: 4,
};
