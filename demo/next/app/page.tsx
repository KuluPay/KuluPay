"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { payClient } from "@/lib/pay-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Loader2, ArrowRight, Zap } from "lucide-react";
import {
  StripeIcon,
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

const providers: ProviderOption[] = [
  { id: "ethereum", label: "Ethereum", token: "USDC", icon: EthereumIcon, color: "#627EEA", category: "crypto" },
  { id: "base", label: "Base", token: "USDC", icon: BaseIcon, color: "#0052FF", category: "crypto" },
  { id: "polygon", label: "Polygon", token: "USDC", icon: PolygonIcon, color: "#8247E5", category: "crypto" },
  { id: "arbitrum", label: "Arbitrum", token: "USDC", icon: ArbitrumIcon, color: "#28A0F0", category: "crypto" },
  { id: "tron", label: "TRON", token: "USDT", icon: TronIcon, color: "#FF060A", category: "crypto" },
  { id: "stripe", label: "Stripe", token: "CARD", icon: StripeIcon, color: "#635BFF", category: "fiat" },
  { id: "paypal", label: "PayPal", token: "ACCOUNT", icon: PayPalIcon, color: "#003087", category: "fiat" },
];

export default function Home() {
  const router = useRouter();
  const [amount, setAmount] = useState("10.00");
  const [currency, setCurrency] = useState("USD");
  const [category, setCategory] = useState<Category>("crypto");
  const [selectedProvider, setSelectedProvider] = useState<ProviderOption>(providers[0]);
  const [description, setDescription] = useState("KuluPay demo payment");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredProviders = providers.filter((p) => p.category === category);

  const handleCategoryChange = (cat: Category) => {
    setCategory(cat);
    setSelectedProvider(providers.find((p) => p.category === cat)!);
  };

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

      const body: Record<string, any> = {
        amount: cents,
        currency: currency.toLowerCase(),
        providerId: selectedProvider.id,
        description,
        type: "one_time",
      };

      if (selectedProvider.category === "crypto") {
        body.token = selectedProvider.token;
      }

      const result = await payClient.createIntent({ body });

      if (result?.error) {
        setError(result.error.message || "Failed to create payment");
        setLoading(false);
        return;
      }

      const data = result?.data;
      if (!data?.id || !data?.clientSecret) {
        setError("Missing id or clientSecret in response");
        setLoading(false);
        return;
      }

      // Redirect-based providers (PayPal, Stripe Checkout, etc.)
      if (selectedProvider.category === "fiat") {
        const redirectUrl = data.clientSecret;
        if (typeof redirectUrl === "string" && redirectUrl.startsWith("http")) {
          window.location.href = redirectUrl;
          return;
        }
      }

      // Onchain checkout uses the internal checkout page
      const url = data.checkoutUrl
        ?? `/checkout?intentId=${data.id}&clientSecret=${data.clientSecret}`;
      router.push(url);
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-[#050505] p-4 text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-indigo-500/10 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-purple-500/10 blur-[100px]" />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs backdrop-blur-sm">
            <Zap className="size-3 text-yellow-400" />
            <span className="text-white/70">Beta</span>
            <span className="text-white/40">•</span>
            <span className="text-white/70">One SDK. Crypto + Fiat.</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-white">KuluPay Demo</h1>
          <p className="mt-1 text-sm text-white/50">Create a payment with Stripe, PayPal, or crypto.</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl backdrop-blur-md">
          <div className="mb-6 flex gap-2 rounded-xl border border-white/10 bg-black/20 p-1">
            <button
              onClick={() => handleCategoryChange("crypto")}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${category === "crypto" ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/25" : "text-white/50 hover:text-white"}`}
            >
              Crypto
            </button>
            <button
              onClick={() => handleCategoryChange("fiat")}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${category === "fiat" ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/25" : "text-white/50 hover:text-white"}`}
            >
              Fiat
            </button>
          </div>

          <div className="mb-6">
            <Label className="mb-2 block text-xs font-medium text-white/60 uppercase tracking-wider">Select provider</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {filteredProviders.map((p) => {
                const PIcon = p.icon;
                const active = selectedProvider.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProvider(p)}
                    className={`flex flex-col items-center gap-2 rounded-xl border p-3 transition-all ${active ? "border-white/20 bg-white/10 text-white shadow-lg" : "border-white/5 bg-white/[0.02] text-white/60 hover:border-white/10 hover:bg-white/5 hover:text-white"}`}
                  >
                    <PIcon className="size-6" style={{ color: active ? p.color : undefined }} />
                    <span className="text-xs font-medium">{p.label}</span>
                    {p.category === "crypto" && (
                      <Badge variant="secondary" className="bg-white/10 text-[10px] text-white/70 hover:bg-white/10">
                        {p.token}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mb-6 space-y-4">
            <div>
              <Label htmlFor="amount" className="mb-2 block text-xs font-medium text-white/60 uppercase tracking-wider">Amount</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40">$</span>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="h-12 border-white/10 bg-black/20 pl-7 text-lg text-white placeholder:text-white/30 focus:border-indigo-500/50 focus:ring-indigo-500/20"
                    placeholder="10.00"
                  />
                </div>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="h-12 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-indigo-500/50"
                >
                  <option value="USD" className="bg-[#0a0a0a]">USD</option>
                  <option value="ETB" className="bg-[#0a0a0a]">ETB</option>
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor="description" className="mb-2 block text-xs font-medium text-white/60 uppercase tracking-wider">Description</Label>
              <Input
                id="description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="h-11 border-white/10 bg-black/20 text-white placeholder:text-white/30 focus:border-indigo-500/50"
                placeholder="Demo payment"
              />
            </div>
          </div>

          {error && (
            <div className="mb-5 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button
            onClick={handlePay}
            disabled={loading}
            size="lg"
            className="group relative h-12 w-full overflow-hidden rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 font-medium text-white shadow-lg shadow-indigo-500/25 transition-all hover:shadow-indigo-500/40 disabled:opacity-60"
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              {loading && <Loader2 className="size-4 animate-spin" />}
              {loading ? "Creating intent..." : (
                <>
                  Pay {amount} {currency} with {selectedProvider.label}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </span>
          </Button>

          <div className="mt-5 flex items-center justify-between text-[11px] text-white/30">
            <span>POST /api/pay/create-intent</span>
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {selectedProvider.category === "crypto" ? "Wallet checkout" : "Redirect checkout"}
            </span>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-white/30">
          Powered by KuluPay — one SDK for Stripe, PayPal, Ethereum, Base, Polygon, Arbitrum, and TRON.
        </p>
      </div>
    </div>
  );
}
