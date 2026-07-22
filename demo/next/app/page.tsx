"use client";

import { useEffect, useRef } from "react";
import { usePaymentProvider } from "@kulupay/kulupay/client";
import { payClient, stripeProvider } from "@/lib/pay-client";
export default function Home() {
  const pay = usePaymentProvider({
    client: payClient,
    provider: stripeProvider,
    providerId: "stripe",
  });

  const elementsRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pay.intent?.clientSecret && !elementsRef.current) {
      pay.createElements({ clientSecret: pay.intent.clientSecret }).then((elements) => {
        elementsRef.current = elements;
        const paymentElement = elements.create("payment");
        paymentElement.mount(containerRef.current);
      });
    }
  }, [pay.intent]);

  const handlePay = async () => {
    await pay.createIntent({
      amount: 0,
      currency: "usd",
      userId: "user_demo",
      providerId: "stripe",
      metadata: { productId: "prod_premium" },
    });
  };

  const handleConfirm = async () => {
    try {
      const result = await pay.confirmPayment({
        elements: elementsRef.current,
        redirectUrl: window.location.href,
      });
      alert(`Payment ${result.status}: ${result.id}`);
    } catch (err: any) {
      alert(err.message || "Payment failed");
    }
  };

  const hasStripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  if (!hasStripeKey) {
    return (
      <main style={{ padding: 24, fontFamily: "sans-serif" }}>
        <h1>KuluPay Stripe Demo</h1>
        <p style={{ color: "#666" }}>
          Add <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> and{" "}
          <code>STRIPE_API_KEY</code> to <code>.env.local</code> to test Stripe.
        </p>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif", maxWidth: 480 }}>
      <h1>KuluPay Stripe Demo</h1>

      {!pay.intent && (
        <button
          onClick={handlePay}
          disabled={pay.loading}
          style={{ padding: "12px 24px", cursor: pay.loading ? "not-allowed" : "pointer" }}
        >
          {pay.loading ? "Creating..." : "Buy Premium ($25.00)"}
        </button>
      )}

      {pay.intent && pay.intent.status !== "succeeded" && (
        <>
          <div ref={containerRef} style={{ marginBottom: 16, minHeight: 200 }} />
          <button
            onClick={handleConfirm}
            disabled={pay.loading}
            style={{ padding: "12px 24px", cursor: pay.loading ? "not-allowed" : "pointer" }}
          >
            {pay.loading ? "Confirming..." : "Confirm Payment"}
          </button>
        </>
      )}

      {pay.intent?.status === "succeeded" && (
        <p style={{ color: "green" }}>Payment succeeded! ID: {pay.intent.id}</p>
      )}

      {pay.error && <p style={{ color: "red" }}>Error: {pay.error.message}</p>}

      {pay.intent && (
        <details style={{ marginTop: 16 }}>
          <summary>Payment Intent Details</summary>
          <pre style={{ fontSize: 12, overflow: "auto" }}>
            {JSON.stringify(pay.intent, null, 2)}
          </pre>
        </details>
      )}
    </main>
  );
}
