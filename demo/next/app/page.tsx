"use client";

import { payClient } from "@/lib/pay-client";

export default function Home() {
  const { createIntent, loading, error } = payClient.usePayment({ providerId: "mock" });

  const handlePay = async () => {
    try {
      const intent = await createIntent({
        amount: 1000,
        currency: "USD",
        userId: "user_demo",
        providerId: "",
        metadata: { orderId: "demo-1" },
      });
      alert(JSON.stringify(intent, null, 2));
    } catch (err: any) {
      alert(err.message || "Payment failed");
    }
  };

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1>KuluPay Next.js Demo</h1>
      <button
        onClick={handlePay}
        disabled={loading}
        style={{ padding: "12px 24px", cursor: loading ? "not-allowed" : "pointer" }}
      >
        {loading ? "Processing..." : "Pay $10.00"}
      </button>
      {error && <p style={{ color: "red" }}>Error: {error}</p>}
    </main>
  );
}
