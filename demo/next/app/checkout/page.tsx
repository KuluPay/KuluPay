"use client";

import { Suspense, use } from "react";
import { Loader2 } from "lucide-react";
import { useKuluPayCheckout } from "@kulupay/kulupay/checkout/react";
import { KuluPayConnectButton } from "@kulupay/kulupay/appkit/react";
import { payClient } from "@/lib/pay-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SearchParams = Promise<{ intentId?: string; clientSecret?: string }>;

function formatAmount(amount?: number, currency?: string) {
  if (!amount || !currency) return "—";
  return `${(amount / 100).toFixed(2)} ${currency}`;
}

function CheckoutContent({ searchParams }: { searchParams: SearchParams }) {
  const { intentId, clientSecret } = use(searchParams);

  if (!intentId || !clientSecret) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background p-4">
        <p className="text-sm text-muted-foreground">Need intentId and clientSecret query params.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <CheckoutCard intentId={intentId} clientSecret={clientSecret} />
    </div>
  );
}

function CheckoutCard({ intentId, clientSecret }: { intentId: string; clientSecret: string }) {
  const { intent, status, error, txHash, connected, address, connect, pay } = useKuluPayCheckout({
    client: payClient,
    intentId,
    clientSecret,
    onSuccess: (txHash: string) => console.log("Payment complete:", txHash),
    onError: (err: Error) => console.error("Payment failed:", err),
  });

  if (status === "loading") {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">Loading payment…</p>
        </CardContent>
      </Card>
    );
  }

  if (status === "error" || !intent) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="py-8 text-center">
          <p className="text-sm text-destructive">{error || "Failed to load payment"}</p>
        </CardContent>
      </Card>
    );
  }

  if (status === "expired") {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="py-8 text-center">
          <p className="text-sm text-muted-foreground">This payment link has expired.</p>
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
      <Card className="w-full max-w-md">
        <CardContent className="py-8 text-center">
          <p className="text-lg font-semibold">Payment complete</p>
          <p className="text-sm text-muted-foreground">{formatAmount(intent.amount, intent.currency)} sent</p>
          {explorerUrl && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-sm text-primary underline"
            >
              View on block explorer
            </a>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-center text-lg">
          Pay {formatAmount(intent.amount, intent.currency)} to Test payment
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {connected && address ? (
          <>
            <div className="rounded-lg border p-3 text-sm">
              <p className="text-muted-foreground">Connected wallet</p>
              <p className="font-mono">{address}</p>
            </div>
            <Button onClick={pay} disabled={status === "sending" || status === "confirming"} className="w-full">
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
            className="w-full"
          />
        )}
        {error && <p className="text-center text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

export default function CheckoutRoute({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={
      <div className="flex min-h-svh items-center justify-center bg-background p-4">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <CheckoutContent searchParams={searchParams} />
    </Suspense>
  );
}
