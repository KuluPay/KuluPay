"use client";

import { useEffect, useRef, useState } from "react";
import { usePaymentProvider } from "@kulupay/kulupay/client";
import {
  payClient,
  stripeProvider,
  baseUsdcProvider,
  ethProvider,
  tronUsdtProvider,
  tronTrxProvider,
} from "@/lib/pay-client";

type ProviderKey =
  | "stripe"
  | "evm-base-usdc"
  | "evm-eth"
  | "tron-usdt"
  | "tron-trx";

const PROVIDERS: { key: ProviderKey; label: string; description: string }[] = [
  { key: "stripe", label: "Stripe", description: "Card / Apple Pay / Google Pay" },
  { key: "evm-base-usdc", label: "Base USDC", description: "MetaMask / Coinbase Wallet" },
  { key: "evm-eth", label: "Ethereum ETH", description: "MetaMask / EIP-1193 wallet" },
  { key: "tron-usdt", label: "Tron USDT", description: "TronLink wallet" },
  { key: "tron-trx", label: "Tron TRX", description: "TronLink wallet" },
];

function getProviderByKey(key: ProviderKey) {
  switch (key) {
    case "stripe":
      return stripeProvider;
    case "evm-base-usdc":
      return baseUsdcProvider;
    case "evm-eth":
      return ethProvider;
    case "tron-usdt":
      return tronUsdtProvider;
    case "tron-trx":
      return tronTrxProvider;
  }
}

export default function Home() {
  const [selectedProvider, setSelectedProvider] = useState<ProviderKey>("stripe");
  const provider = getProviderByKey(selectedProvider);

  const pay = usePaymentProvider({
    client: payClient,
    provider,
    providerId: selectedProvider,
  });

  const elementsRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (
      selectedProvider === "stripe" &&
      pay.intent?.clientSecret &&
      !elementsRef.current
    ) {
      pay.createElements({ clientSecret: pay.intent.clientSecret }).then((elements) => {
        elementsRef.current = elements;
        const paymentElement = elements.create("payment");
        paymentElement.mount(containerRef.current);
      });
    }
  }, [pay.intent, selectedProvider, pay.createElements]);

  const handleCreateIntent = async () => {
    elementsRef.current = null;
    await pay.createIntent({
      amount: 2500,
      currency: "usd",
      userId: "user_demo",
      providerId: selectedProvider,
      productId: "prod_premium",
    });
  };

  const handleConfirm = async () => {
    if (selectedProvider === "stripe") {
      const result = await pay.confirmPayment({
        elements: elementsRef.current,
        redirectUrl: window.location.href,
      });
      alert(`Stripe payment ${result.status}: ${result.id}`);
      return;
    }

    // Crypto: use payment data from intent.raw
    const intent = pay.intent;
    if (!intent) {
      alert("Create a payment intent first");
      return;
    }

    try {
      const result = await pay.confirmPayment({
        paymentMethodData: intent.raw,
      });

      setVerifying(true);
      const verified = await pay.verifyPayment(result.id);
      setVerifying(false);

      alert(`Crypto payment ${verified.status}: ${result.id}`);
    } catch (err: any) {
      setVerifying(false);
      alert(err.message || "Payment failed");
    }
  };

  const hasStripe = Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif", maxWidth: 600 }}>
      <h1>KuluPay Checkout Demo</h1>
      <p style={{ color: "#666" }}>
        Unified Stripe + EVM + Tron payments via one API.
      </p>

      {!hasStripe && selectedProvider === "stripe" && (
        <p style={{ color: "#c00" }}>
          Add <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> to test Stripe.
        </p>
      )}

      <div style={{ margin: "24px 0" }}>
        <label style={{ fontWeight: 600 }}>Payment method</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {PROVIDERS.map((p) => (
            <button
              key={p.key}
              onClick={() => {
                setSelectedProvider(p.key);
                pay.getIntent(""); // reset provider-bound state
              }}
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #ccc",
                background: selectedProvider === p.key ? "#111" : "#fff",
                color: selectedProvider === p.key ? "#fff" : "#111",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div style={{ fontWeight: 600 }}>{p.label}</div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>{p.description}</div>
            </button>
          ))}
        </div>
      </div>

      {!pay.intent && (
        <button
          onClick={handleCreateIntent}
          disabled={pay.loading}
          style={{
            padding: "12px 24px",
            cursor: pay.loading ? "not-allowed" : "pointer",
            fontSize: 16,
          }}
        >
          {pay.loading ? "Creating..." : "Pay $25.00 with " + PROVIDERS.find((p) => p.key === selectedProvider)?.label}
        </button>
      )}

      {pay.intent && selectedProvider === "stripe" && pay.intent.status !== "succeeded" && (
        <>
          <div
            ref={containerRef}
            style={{ marginBottom: 16, minHeight: 200, border: "1px solid #eee", borderRadius: 8 }}
          />
          <button
            onClick={handleConfirm}
            disabled={pay.loading}
            style={{ padding: "12px 24px", cursor: pay.loading ? "not-allowed" : "pointer" }}
          >
            {pay.loading ? "Confirming..." : "Confirm Card Payment"}
          </button>
        </>
      )}

      {pay.intent && selectedProvider !== "stripe" && pay.intent.status !== "succeeded" && (
        <>
          <div
            style={{
              marginBottom: 16,
              padding: 12,
              background: "#f7f7f7",
              borderRadius: 8,
              fontSize: 13,
            }}
          >
            <strong>Payment data ready</strong>
            <pre style={{ overflow: "auto" }}>
              {JSON.stringify(pay.intent.raw, null, 2)}
            </pre>
            <p>Your wallet will open when you confirm.</p>
          </div>
          <button
            onClick={handleConfirm}
            disabled={pay.loading || verifying}
            style={{ padding: "12px 24px", cursor: pay.loading || verifying ? "not-allowed" : "pointer" }}
          >
            {pay.loading || verifying ? "Processing..." : `Confirm with Wallet`}
          </button>
        </>
      )}

      {pay.intent?.status === "succeeded" && (
        <p style={{ color: "green" }}>
          Payment succeeded! ID: {pay.intent.id}
        </p>
      )}

      {pay.error && <p style={{ color: "red" }}>Error: {pay.error.message}</p>}

      {pay.intent && (
        <details style={{ marginTop: 24 }}>
          <summary>Payment Intent Details</summary>
          <pre style={{ fontSize: 12, overflow: "auto" }}>
            {JSON.stringify(pay.intent, null, 2)}
          </pre>
        </details>
      )}
    </main>
  );
}
