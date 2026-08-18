"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { payClient } from "@/lib/pay-client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertCircle,
  Loader2,
  CreditCard,
  Wallet,
  ShieldCheck,
  Zap,
  Star,
  Sun,
  Moon,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import { CheckoutPanel } from "@/components/checkout-panel";
import {
  PayPalIcon,
  EthereumIcon,
  BaseIcon,
  PolygonIcon,
  ArbitrumIcon,
  TronIcon,
} from "@/components/provider-icons";

type Category = "crypto" | "fiat";

interface ProviderOption {
  id: string;
  label: string;
  token: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  category: Category;
}

const cryptoProviders: ProviderOption[] = [
  { id: "ethereum", label: "Ethereum", token: "USDC", icon: EthereumIcon, color: "#627EEA", category: "crypto" },
  { id: "base", label: "Base", token: "USDC", icon: BaseIcon, color: "#0052FF", category: "crypto" },
  { id: "polygon", label: "Polygon", token: "USDC", icon: PolygonIcon, color: "#8247E5", category: "crypto" },
  { id: "arbitrum", label: "Arbitrum", token: "USDC", icon: ArbitrumIcon, color: "#28A0F0", category: "crypto" },
  { id: "tron", label: "TRON", token: "USDT", icon: TronIcon, color: "#FF060A", category: "crypto" },
];

const PRODUCT = {
  name: "Claude Code — 1 Year Free",
  blurb: "Get 12 months of Claude Code, Anthropic's agentic coding assistant. Terminal-native AI pair programmer that edits files, runs commands, and ships features.",
  price: "75.00",
  rating: 5.0,
  reviews: 1842,
  lineItem: "Claude Code Annual Subscription",
  lineNote: "12 months · Pro plan · Instant activation",
  features: [
    "12 months of unlimited Claude Code access",
    "Terminal-native AI pair programming",
    "Full codebase context & multi-file edits",
    "Cancel anytime — no auto-renewal",
  ],
};

export default function Home() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [method, setMethod] = useState<"card" | "paypal" | "crypto">("card");
  const [chain, setChain] = useState<ProviderOption>(cryptoProviders[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intentId, setIntentId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<"success" | "canceled" | null>(null);

  useEffect(() => {
    setMounted(true);
    const params = new URLSearchParams(window.location.search);
    if (params.get("success")) setPaymentStatus("success");
    if (params.get("canceled")) setPaymentStatus("canceled");
  }, []);

  const resetCheckout = () => {
    setIntentId(null);
    setClientSecret(null);
    setError(null);
  };

  const total = `$${parseFloat(PRODUCT.price).toFixed(2)} USD`;

  const handlePay = async () => {
    setError(null);
    setLoading(true);

    try {
      const cents = Math.round(parseFloat(PRODUCT.price) * 100);
      if (!cents || cents <= 0) {
        setError("Invalid product price");
        return;
      }

      const providerId =
        method === "card" ? "stripe" : method === "paypal" ? "paypal" : chain.id;

      const body: Record<string, any> = {
        amount: cents,
        currency: "usd",
        providerId,
        description: PRODUCT.lineItem,
        type: "one_time",
      };

      if (method === "crypto") body.token = chain.token;

      console.log("───── KuluPay Checkout Flow ─────");
      console.log("[client] Payment method:", method);
      console.log("[client] Provider ID:", providerId);
      console.log("[client] Amount:", cents, "cents ($" + (cents / 100).toFixed(2) + ")");
      console.log("[client] Currency: USD");
      if (method === "crypto") console.log("[client] Chain:", chain.label, "| Token:", chain.token);
      console.log("[client] → POST /api/pay/create-intent", body);

      const result = await payClient.createIntent({ body });

      console.log("[client] ← Response:", result);

      if (result?.error) {
        console.error("[client] ✗ Error from server:", result.error);
        const errMsg = result.error.message || "Failed to create payment";
        const errCode = result.error.code ? ` [${result.error.code}]` : "";
        setError(`${errMsg}${errCode}`);
        return;
      }

      const data = result?.data;
      if (!data?.id || !data?.clientSecret) {
        console.error("[client] ✗ Missing id or clientSecret:", data);
        setError("Missing id or clientSecret in response");
        return;
      }

      console.log("[client] ✓ Intent created:", data.id);
      console.log("[client] ✓ Client secret:", data.clientSecret?.substring(0, 50) + "...");

      if (method === "card" || method === "paypal") {
        const redirectUrl = data.clientSecret;
        console.log("[client] → Redirecting to:", redirectUrl?.substring(0, 80) + "...");
        if (typeof redirectUrl === "string" && redirectUrl.startsWith("http")) {
          window.location.href = redirectUrl;
          return;
        }
      }

      console.log("[client] → Rendering inline checkout (crypto)");
      setIntentId(data.id);
      setClientSecret(data.clientSecret);
    } catch (err: any) {
      console.error("[client] ✗ Exception:", err);
      setError(err?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4 text-foreground md:p-8">
      <div className="w-full max-w-5xl">
        {paymentStatus && (
          <div
            className={`mb-3 flex items-center gap-2 rounded-xl border p-3 text-sm ${
              paymentStatus === "success"
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400"
            }`}
          >
            {paymentStatus === "success" ? (
              <CheckCircle2 className="size-4 shrink-0" />
            ) : (
              <XCircle className="size-4 shrink-0" />
            )}
            <span>
              {paymentStatus === "success"
                ? "Payment successful! Your Claude Code subscription is active."
                : "Payment was canceled. No charge was made."}
            </span>
            <button
              onClick={() => {
                setPaymentStatus(null);
                window.history.replaceState({}, "", "/");
              }}
              className="ml-auto text-xs underline opacity-70 hover:opacity-100"
            >
              Dismiss
            </button>
          </div>
        )}
        <div className="mb-3 flex justify-end">
          {mounted && (
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="flex size-9 items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors hover:bg-accent"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
          )}
        </div>
        <Card className="overflow-hidden border-border bg-card p-0 text-card-foreground">
          {intentId && clientSecret ? (
            <CheckoutPanel intentId={intentId} clientSecret={clientSecret} onReset={resetCheckout} />
          ) : (
            <div className="grid md:grid-cols-[1fr_1fr]">
              <div className="flex flex-col border-b border-border p-5 md:border-b-0 md:border-r md:p-6">
                <div className="mb-3 flex items-center gap-2 text-xs">
                  <div className="flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1">
                    <Star className="size-3 fill-yellow-400 text-yellow-400" />
                    <span className="text-muted-foreground">{PRODUCT.rating}</span>
                    <span className="text-muted-foreground/60">({PRODUCT.reviews})</span>
                  </div>
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1">
                    <Zap className="size-3 text-yellow-400" />
                    <span className="text-muted-foreground">Crypto + Fiat</span>
                  </div>
                </div>

                <div className="flex gap-4 rounded-xl border border-border bg-muted/50 p-3">
                  <div className="flex size-20 shrink-0 items-center justify-center rounded-xl bg-muted">
                    <Image
                      src="/claude-color.svg"
                      alt="Claude"
                      width={48}
                      height={48}
                      className="size-12"
                    />
                  </div>
                  <div className="flex flex-col justify-center">
                    <p className="text-sm font-medium">{PRODUCT.lineItem}</p>
                    <p className="text-xs text-muted-foreground">{PRODUCT.lineNote}</p>
                    <p className="mt-1 text-lg font-semibold">{total}</p>
                  </div>
                </div>

                <ul className="mt-3 space-y-1">
                  {PRODUCT.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="mt-auto space-y-2 pt-4">
                  <Separator />
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Subtotal</span>
                    <span>{total}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Tax</span>
                    <span>$0.00 USD</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between text-base font-medium">
                    <span>Total due</span>
                    <span>{total}</span>
                  </div>
                  <p className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                    <ShieldCheck className="size-3.5" /> Encrypted and secure checkout
                  </p>
                </div>
              </div>

              <div className="flex flex-col p-5 md:p-6">
                <h2 className="mb-4 text-lg font-semibold">Payment Method</h2>

                <Tabs
                  value={method}
                  onValueChange={(v) => {
                    console.log("[tabs] onValueChange:", v);
                    if (v) setMethod(v as typeof method);
                  }}
                  className="flex flex-1 flex-col"
                >
                  <TabsList className="mb-4 grid w-full grid-cols-3 bg-muted p-1">
                    <TabsTrigger value="card" className="data-active:bg-accent data-active:text-accent-foreground">
                      <CreditCard className="mr-1.5 size-4" /> Card
                    </TabsTrigger>
                    <TabsTrigger value="paypal" className="data-active:bg-accent data-active:text-accent-foreground">
                      <PayPalIcon className="mr-1.5 size-4" /> PayPal
                    </TabsTrigger>
                    <TabsTrigger value="crypto" className="data-active:bg-accent data-active:text-accent-foreground">
                      <Wallet className="mr-1.5 size-4" /> Crypto
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="card" className="flex flex-col items-center gap-3 py-4 text-center">
                    <CreditCard className="size-10 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">
                      You&apos;ll be redirected to Stripe Checkout to enter your card details.
                    </p>
                  </TabsContent>

                  <TabsContent value="paypal" className="flex flex-col items-center gap-3 py-4 text-center">
                    <PayPalIcon className="size-10 text-[#003087]" />
                    <p className="text-sm text-muted-foreground">
                      You&apos;ll be redirected to PayPal to approve this payment.
                    </p>
                  </TabsContent>

                  <TabsContent value="crypto" className="flex flex-col gap-3">
                    <div className="flex flex-wrap gap-2">
                      {cryptoProviders.map((p) => {
                        const PIcon = p.icon;
                        const active = chain.id === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setChain(p)}
                            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                              active
                                ? "border-border bg-accent text-accent-foreground"
                                : "border-border/50 bg-muted/30 text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground"
                            }`}
                          >
                            <PIcon className="size-4" style={{ color: active ? p.color : undefined }} />
                            {p.label}
                            <span className="text-muted-foreground/50">{p.token}</span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      You&apos;ll connect a wallet and sign the transfer on the next step.
                    </p>
                  </TabsContent>
                </Tabs>

                <div className="mt-4 space-y-3">
                  {error && (
                    <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-2.5 text-sm text-red-200">
                      <AlertCircle className="size-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <Button
                    onClick={handlePay}
                    disabled={loading}
                    className="h-11 w-full rounded-lg font-medium disabled:opacity-50"
                  >
                    {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
                    {loading ? "Creating payment…" : `Pay ${total}`}
                  </Button>

                  <p className="text-center text-xs text-muted-foreground">
                    Encrypted and secure checkout
                  </p>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
