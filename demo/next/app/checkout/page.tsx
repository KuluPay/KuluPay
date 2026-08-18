"use client";

import { Suspense, use } from "react";
import Link from "next/link";
import { Loader2, CheckCircle2, XCircle, ExternalLink, ArrowLeft } from "lucide-react";
import { useKuluPayCheckout } from "@kulupay/kulupay/checkout/react";
import { KuluPayConnectButton } from "@kulupay/kulupay/appkit/react";
import { payClient } from "@/lib/pay-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  EthereumIcon,
  BaseIcon,
  PolygonIcon,
  ArbitrumIcon,
  TronIcon,
  StripeIcon,
  PayPalIcon,
} from "@/components/provider-icons";

type SearchParams = Promise<{
  intentId?: string;
  clientSecret?: string;
  success?: string;
  canceled?: string;
}>;

const providerMeta: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  ethereum: { label: "Ethereum", icon: EthereumIcon, color: "#627EEA" },
  base: { label: "Base", icon: BaseIcon, color: "#0052FF" },
  polygon: { label: "Polygon", icon: PolygonIcon, color: "#8247E5" },
  arbitrum: { label: "Arbitrum", icon: ArbitrumIcon, color: "#28A0F0" },
  tron: { label: "TRON", icon: TronIcon, color: "#FF060A" },
  stripe: { label: "Stripe", icon: StripeIcon, color: "#635BFF" },
  paypal: { label: "PayPal", icon: PayPalIcon, color: "#003087" },
};

function formatAmount(amount?: number, currency?: string) {
  if (!amount || !currency) return "—";
  return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

function CheckoutShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-[#050505] p-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-indigo-500/10 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-purple-500/10 blur-[100px]" />
      </div>
      <div className="relative z-10 w-full max-w-md">
        {children}
      </div>
    </div>
  );
}

function CheckoutContent({ searchParams }: { searchParams: SearchParams }) {
  const params = use(searchParams);
  const { intentId, clientSecret, success, canceled } = params;

  if (success) {
    return (
      <CheckoutShell>
        <Card className="border-white/10 bg-white/[0.03] text-white backdrop-blur-md">
          <CardContent className="flex flex-col items-center py-12 text-center">
            <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle2 className="size-8 text-emerald-400" />
            </div>
            <h2 className="text-xl font-semibold">Payment successful</h2>
            <p className="mt-2 text-sm text-white/50">Your payment has been processed.</p>
            <Link href="/" className="mt-6">
              <Button variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                <ArrowLeft className="mr-2 size-4" /> Back to demo
              </Button>
            </Link>
          </CardContent>
        </Card>
      </CheckoutShell>
    );
  }

  if (canceled) {
    return (
      <CheckoutShell>
        <Card className="border-white/10 bg-white/[0.03] text-white backdrop-blur-md">
          <CardContent className="flex flex-col items-center py-12 text-center">
            <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-amber-500/10">
              <XCircle className="size-8 text-amber-400" />
            </div>
            <h2 className="text-xl font-semibold">Payment canceled</h2>
            <p className="mt-2 text-sm text-white/50">You can try again with a different method.</p>
            <Link href="/" className="mt-6">
              <Button variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                <ArrowLeft className="mr-2 size-4" /> Try again
              </Button>
            </Link>
          </CardContent>
        </Card>
      </CheckoutShell>
    );
  }

  if (!intentId || !clientSecret) {
    return (
      <CheckoutShell>
        <Card className="border-white/10 bg-white/[0.03] text-white backdrop-blur-md">
          <CardContent className="py-8 text-center">
            <p className="text-sm text-white/50">Need intentId and clientSecret query params.</p>
          </CardContent>
        </Card>
      </CheckoutShell>
    );
  }

  return <CheckoutCard intentId={intentId} clientSecret={clientSecret} />;
}

function CheckoutCard({ intentId, clientSecret }: { intentId: string; clientSecret: string }) {
  const { intent, status, error, txHash, connected, address, pay } = useKuluPayCheckout({
    client: payClient,
    intentId,
    clientSecret,
    onSuccess: (txHash: string) => console.log("Payment complete:", txHash),
    onError: (err: Error) => console.error("Payment failed:", err),
  });

  const provider = intent?.providerId ? providerMeta[intent.providerId] : null;
  const ProviderIcon = provider?.icon;

  if (status === "loading") {
    return (
      <Card className="border-white/10 bg-white/[0.03] text-white backdrop-blur-md">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-indigo-400" />
          <p className="mt-4 text-sm text-white/50">Loading payment…</p>
        </CardContent>
      </Card>
    );
  }

  if (status === "error" || !intent) {
    return (
      <Card className="border-white/10 bg-white/[0.03] text-white backdrop-blur-md">
        <CardContent className="py-8 text-center">
          <p className="text-sm text-red-300">{error || "Failed to load payment"}</p>
          <Link href="/" className="mt-4 inline-block text-sm text-white/50 hover:text-white">
            ← Back to demo
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (status === "expired") {
    return (
      <Card className="border-white/10 bg-white/[0.03] text-white backdrop-blur-md">
        <CardContent className="py-8 text-center">
          <p className="text-sm text-white/50">This payment link has expired.</p>
        </CardContent>
      </Card>
    );
  }

  if (status === "success") {
    const chainConfig = intent.chainConfig;
    const explorerUrl = chainConfig?.explorerUrl && txHash
      ? chainConfig.family === "tron"
        ? `${chainConfig.explorerUrl}/#/transaction/${txHash}`
        : `${chainConfig.explorerUrl}/tx/${txHash}`
      : null;
    return (
      <Card className="border-white/10 bg-white/[0.03] text-white backdrop-blur-md">
        <CardContent className="flex flex-col items-center py-12 text-center">
          <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle2 className="size-8 text-emerald-400" />
          </div>
          <h2 className="text-xl font-semibold">Payment complete</h2>
          <p className="mt-2 text-sm text-white/50">{formatAmount(intent.amount, intent.currency)} sent</p>
          {explorerUrl && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white"
            >
              View on block explorer <ExternalLink className="size-3.5" />
            </a>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-white/10 bg-white/[0.03] text-white backdrop-blur-md">
      <CardHeader>
        <div className="flex flex-col items-center gap-3 text-center">
          {ProviderIcon && (
            <div className="flex size-12 items-center justify-center rounded-2xl bg-white/5" style={{ color: provider?.color }}>
              <ProviderIcon className="size-7" />
            </div>
          )}
          <CardTitle className="text-lg font-medium">
            Pay {formatAmount(intent.amount, intent.currency)}
          </CardTitle>
          <p className="text-xs text-white/40">{intent.description}</p>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {connected && address ? (
          <>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
              <p className="mb-1 text-white/40">Connected wallet</p>
              <p className="font-mono text-xs text-white/80">{address}</p>
            </div>
            <Button
              onClick={pay}
              disabled={status === "sending" || status === "confirming"}
              className="h-11 w-full rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 font-medium text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 disabled:opacity-60"
            >
              {(status === "sending" || status === "confirming") && <Loader2 className="mr-2 size-4 animate-spin" />}
              {status === "sending"
                ? "Waiting for wallet…"
                : status === "confirming"
                  ? "Confirming on-chain…"
                  : `Pay ${formatAmount(intent.amount, intent.currency)}`}
            </Button>
          </>
        ) : (
          <KuluPayConnectButton
            chains={intent.chainConfig ? [intent.chainConfig] : []}
            label="Connect wallet"
            className="w-full rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-medium text-white hover:bg-white/10"
          />
        )}
        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-center text-sm text-red-200">
            {error}
          </div>
        )}
        <Link href="/" className="text-center text-xs text-white/30 hover:text-white/60">
          ← Cancel and go back
        </Link>
      </CardContent>
    </Card>
  );
}

export default function CheckoutRoute({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={
      <CheckoutShell>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="size-8 animate-spin text-indigo-400" />
          <p className="text-sm text-white/50">Loading...</p>
        </div>
      </CheckoutShell>
    }>
      <CheckoutContent searchParams={searchParams} />
    </Suspense>
  );
}
