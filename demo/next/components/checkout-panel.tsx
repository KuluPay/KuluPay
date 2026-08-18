"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ArrowLeft,
  CreditCard,
  Wallet,
  Landmark,
  Package,
  ShieldCheck,
} from "lucide-react";
import { useKuluPayCheckout } from "@kulupay/kulupay/checkout/react";
import { KuluPayConnectButton } from "@kulupay/kulupay/appkit/react";
import { payClient } from "@/lib/pay-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  EthereumIcon,
  BaseIcon,
  PolygonIcon,
  ArbitrumIcon,
  TronIcon,
  StripeIcon,
  PayPalIcon,
} from "@/components/provider-icons";

const providerMeta: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
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

function OrderSummary({ intent }: { intent: any }) {
  const provider = intent?.providerId ? providerMeta[intent.providerId] : null;
  const ProviderIcon = provider?.icon;

  return (
    <div className="flex h-full flex-col p-6 md:p-8">
      <div className="mb-8">
        <p className="text-xs font-medium uppercase tracking-wider text-white/40">Order summary</p>
        <h1 className="mt-1 text-2xl font-semibold text-white">KuluPay Starter Kit</h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/50">
          A complete starter package for building multi-chain and fiat payments with the KuluPay SDK.
        </p>
      </div>

      <div className="mb-6 flex gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex size-20 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20">
          <Package className="size-8 text-indigo-300" />
        </div>
        <div className="flex flex-col justify-center">
          <p className="text-sm font-medium text-white">Starter Kit License</p>
          <p className="text-xs text-white/50">Lifetime access · All providers included</p>
          {ProviderIcon && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex size-5 items-center justify-center rounded-md bg-white/5" style={{ color: provider.color }}>
                <ProviderIcon className="size-3" />
              </div>
              <span className="text-xs text-white/60">{provider.label}</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-auto space-y-3">
        <div className="flex items-center justify-between text-sm text-white/60">
          <span>Subtotal</span>
          <span>{formatAmount(intent?.amount, intent?.currency)}</span>
        </div>
        <div className="flex items-center justify-between text-sm text-white/60">
          <span>Tax</span>
          <span>$0.00</span>
        </div>
        <Separator className="bg-white/10" />
        <div className="flex items-center justify-between text-base font-medium text-white">
          <span>Total due</span>
          <span>{formatAmount(intent?.amount, intent?.currency)}</span>
        </div>
        <p className="flex items-center gap-2 pt-2 text-xs text-white/40">
          <ShieldCheck className="size-3.5" /> Encrypted and secure checkout
        </p>
      </div>
    </div>
  );
}

function PaymentMethodTabs({
  intent,
  status,
  connected,
  address,
  pay,
  error,
  txHash,
  onReset,
}: {
  intent: any;
  status: string;
  connected: boolean;
  address: string | null;
  pay: () => Promise<void>;
  error: string | null;
  txHash: string | null;
  onReset?: () => void;
}) {
  const [activeTab, setActiveTab] = useState(() => {
    if (intent?.providerId && providerMeta[intent.providerId]) {
      return intent.providerId === "stripe" ? "card" : intent.providerId === "paypal" ? "paypal" : "wallet";
    }
    return "wallet";
  });

  const isCrypto = !!intent?.chainConfig;
  const amount = formatAmount(intent?.amount, intent?.currency);

  if (status === "success") {
    const chainConfig = intent.chainConfig;
    const explorerUrl =
      chainConfig?.explorerUrl && txHash
        ? chainConfig.family === "tron"
          ? `${chainConfig.explorerUrl}/#/transaction/${txHash}`
          : `${chainConfig.explorerUrl}/tx/${txHash}`
        : null;
    return (
      <div className="flex flex-col items-center py-10 text-center md:py-16">
        <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-emerald-500/10">
          <CheckCircle2 className="size-8 text-emerald-400" />
        </div>
        <h2 className="text-xl font-semibold text-white">Payment complete</h2>
        <p className="mt-2 text-sm text-white/50">{amount} sent</p>
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
        {onReset && (
          <Button onClick={onReset} className="mt-6" variant="outline">
            Make another payment
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-6 md:p-8">
      <h2 className="mb-1 text-lg font-semibold text-white">Payment Method</h2>
      <p className="mb-6 text-sm text-white/50">Select how you&apos;d like to pay</p>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-1 flex-col">
        <TabsList className="mb-6 grid w-full grid-cols-4 bg-white/5 p-1">
          <TabsTrigger value="card" className="data-active:bg-white/10 data-active:text-white" disabled={isCrypto}>
            <CreditCard className="mr-1.5 size-4" /> Card
          </TabsTrigger>
          <TabsTrigger value="paypal" className="data-active:bg-white/10 data-active:text-white" disabled={isCrypto}>
            <PayPalIcon className="mr-1.5 size-4" /> PayPal
          </TabsTrigger>
          <TabsTrigger value="bank" className="data-active:bg-white/10 data-active:text-white" disabled>
            <Landmark className="mr-1.5 size-4" /> Bank
          </TabsTrigger>
          <TabsTrigger value="wallet" className="data-active:bg-white/10 data-active:text-white" disabled={!isCrypto}>
            <Wallet className="mr-1.5 size-4" /> Wallet
          </TabsTrigger>
        </TabsList>

        <TabsContent value="card" className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="cardNumber" className="text-sm text-white/70">Card number</Label>
            <Input
              id="cardNumber"
              placeholder="1234 5678 9012 3456"
              disabled
              className="h-11 border-white/10 bg-white/[0.03] text-white placeholder:text-white/30 disabled:opacity-50"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="expiry" className="text-sm text-white/70">Expiry date</Label>
              <Input
                id="expiry"
                placeholder="MM / YY"
                disabled
                className="h-11 border-white/10 bg-white/[0.03] text-white placeholder:text-white/30 disabled:opacity-50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cvc" className="text-sm text-white/70">Security code</Label>
              <Input
                id="cvc"
                placeholder="CVC"
                disabled
                className="h-11 border-white/10 bg-white/[0.03] text-white placeholder:text-white/30 disabled:opacity-50"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm text-white/70">Name on card</Label>
            <Input
              id="name"
              placeholder="John Doe"
              disabled
              className="h-11 border-white/10 bg-white/[0.03] text-white placeholder:text-white/30 disabled:opacity-50"
            />
          </div>
          <Button disabled className="mt-2 h-11 w-full rounded-lg bg-white text-black hover:bg-white/90 disabled:opacity-50">
            Pay {amount}
          </Button>
          <p className="text-center text-xs text-white/40">Card payments are handled via Stripe in the live flow.</p>
        </TabsContent>

        <TabsContent value="paypal" className="flex flex-col items-center gap-4 py-4 text-center">
          <PayPalIcon className="size-12 text-[#003087]" />
          <p className="text-sm text-white/60">You&apos;ll be redirected to PayPal to complete this payment.</p>
          <Button disabled className="h-11 w-full rounded-lg bg-[#003087] text-white hover:bg-[#00276b] disabled:opacity-50">
            Continue to PayPal
          </Button>
        </TabsContent>

        <TabsContent value="bank" className="flex flex-col items-center gap-4 py-4 text-center">
          <Landmark className="size-12 text-white/30" />
          <p className="text-sm text-white/60">Bank transfers are not available in the demo.</p>
        </TabsContent>

        <TabsContent value="wallet" className="flex flex-col gap-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-white/40">Pay with crypto</p>
            <div className="mt-3 flex items-center gap-3">
              {intent?.providerId && providerMeta[intent.providerId] && (
                <>
                  <div
                    className="flex size-10 items-center justify-center rounded-xl bg-white/5"
                    style={{ color: providerMeta[intent.providerId].color }}
                  >
                    {(() => {
                      const ProviderIcon = providerMeta[intent.providerId].icon;
                      return <ProviderIcon className="size-6" />;
                    })()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{providerMeta[intent.providerId].label}</p>
                    <p className="text-xs text-white/50">{intent.token ?? intent.metadata?.token ?? "USDC"}</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {connected && address ? (
            <>
              <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
                <p className="mb-1 text-white/40">Connected wallet</p>
                <p className="font-mono text-xs text-white/80">{address}</p>
              </div>
              <Button
                onClick={pay}
                disabled={status === "sending" || status === "confirming"}
                className="h-11 w-full rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 font-medium text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 disabled:opacity-60"
              >
                {(status === "sending" || status === "confirming") && <Loader2 className="mr-2 size-4 animate-spin" />}
                {status === "sending"
                  ? "Waiting for wallet…"
                  : status === "confirming"
                  ? "Confirming on-chain…"
                  : `Pay ${amount}`}
              </Button>
            </>
          ) : (
            <KuluPayConnectButton
              chains={intent.chainConfig ? [intent.chainConfig] : []}
              label="Connect wallet"
              className="w-full rounded-lg border border-white/10 bg-white/5 py-3 text-sm font-medium text-white hover:bg-white/10"
            />
          )}
        </TabsContent>
      </Tabs>

      {error && (
        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-center text-sm text-red-200">
          {error}
        </div>
      )}

      {onReset && (
        <button
          onClick={onReset}
          className="mt-4 text-center text-xs text-white/40 transition-colors hover:text-white/70"
        >
          ← Choose a different provider or amount
        </button>
      )}
    </div>
  );
}

export function CheckoutPanel({
  intentId,
  clientSecret,
  onReset,
}: {
  intentId: string;
  clientSecret: string;
  onReset?: () => void;
}) {
  const { intent, status, error, txHash, connected, address, pay } = useKuluPayCheckout({
    client: payClient,
    intentId,
    clientSecret,
    onSuccess: (txHash: string) => console.log("Payment complete:", txHash),
    onError: (err: Error) => console.error("Payment failed:", err),
  });

  if (status === "loading") {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center">
        <Loader2 className="size-8 animate-spin text-indigo-400" />
        <p className="mt-4 text-sm text-white/50">Loading payment…</p>
      </div>
    );
  }

  if (status === "error" || !intent) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-red-300">{error || "Failed to load payment"}</p>
        {onReset && (
          <button onClick={onReset} className="mt-4 text-sm text-white/50 hover:text-white">
            ← Go back
          </button>
        )}
      </div>
    );
  }

  if (status === "expired") {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-white/50">This payment link has expired.</p>
      </div>
    );
  }

  return (
    <div className="grid min-h-[560px] md:grid-cols-[1.1fr_1fr]">
      <div className="border-b border-white/10 md:border-b-0 md:border-r">
        <OrderSummary intent={intent} />
      </div>
      <div>
        <PaymentMethodTabs
          intent={intent}
          status={status}
          connected={connected}
          address={address}
          pay={pay}
          error={error}
          txHash={txHash}
          onReset={onReset}
        />
      </div>
    </div>
  );
}

export function CheckoutSuccess({ onReset }: { onReset?: () => void }) {
  return (
    <div className="flex flex-col items-center py-12 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-emerald-500/10">
        <CheckCircle2 className="size-8 text-emerald-400" />
      </div>
      <h2 className="text-xl font-semibold text-white">Payment successful</h2>
      <p className="mt-2 text-sm text-white/50">Your payment has been processed.</p>
      {onReset && (
        <Button onClick={onReset} className="mt-6" variant="outline">
          <ArrowLeft className="mr-2 size-4" /> Make another payment
        </Button>
      )}
    </div>
  );
}

export function CheckoutCanceled({ onReset }: { onReset?: () => void }) {
  return (
    <div className="flex flex-col items-center py-12 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-amber-500/10">
        <XCircle className="size-8 text-amber-400" />
      </div>
      <h2 className="text-xl font-semibold text-white">Payment canceled</h2>
      <p className="mt-2 text-sm text-white/50">You can try again with a different method.</p>
      {onReset && (
        <Button onClick={onReset} className="mt-6" variant="outline">
          <ArrowLeft className="mr-2 size-4" /> Try again
        </Button>
      )}
    </div>
  );
}
