"use client";

import { use, Suspense, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, CheckCircle2, Clock, ExternalLink } from "lucide-react";
import { formatAmount, shortenAddress } from "@kulupay/kulupay/checkout/react";
import { useKuluPayAppKitStatus } from "@kulupay/kulupay/appkit/react";
import { useCheckoutIntent, useVerifyIntent, useConfirmPayment } from "@/lib/queries/checkout";

function CheckoutContent({ searchParams }: { searchParams: Promise<{ intentId?: string; clientSecret?: string }> }) {
  const { intentId, clientSecret } = use(searchParams);

  const { intent, isLoading, error } = useCheckoutIntent(intentId, clientSecret);
  const { initFromChains, appKit, isLoading: appKitLoading, error: appKitError } = useKuluPayAppKitStatus();
     useVerifyIntent(intentId, clientSecret, intent);
  const { confirm, confirming, error: confirmError } = useConfirmPayment();
  const [needsConnect, setNeedsConnect] = useState(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (intent?.chainConfig) {
      initFromChains([intent.chainConfig]);
    }
  }, [intent?.chainConfig, initFromChains]);

  useEffect(() => {
    if (!appKit) return;
    const unsub = appKit.subscribeProvider(() => {
      setConnected(appKit.isConnected());
    });
    setConnected(appKit.isConnected());
    return unsub;
  }, [appKit]);

  const handlePay = () => {
    if (!appKit || !intent) return;
    if (!connected) {
      appKit.open();
      setNeedsConnect(true);
      return;
    }
    confirm(intent);
  };

  if (!intentId || !clientSecret) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader><CardTitle className="text-xl text-center">Missing Parameters</CardTitle></CardHeader>
          <CardContent className="text-center text-muted-foreground text-sm">
            Need both <code className="text-foreground">intentId</code> and <code className="text-foreground">clientSecret</code> query params.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 pt-6">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading checkout...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !intent) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="size-5 text-destructive" />
              <CardTitle className="text-xl">Checkout Error</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {(error as Error)?.message || "Failed to load checkout"}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (intent.status === "succeeded") {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-green-500" />
              <CardTitle className="text-xl">Payment Succeeded</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              {formatAmount(intent.amount, intent.currency)} paid via {intent.providerId}
            </p>
            {intent.txHash && (
              <a
                href={`${intent.chainConfig?.explorerUrl ?? ""}/tx/${intent.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-mono text-muted-foreground hover:text-foreground transition-colors"
              >
                {shortenAddress(intent.txHash, 10)}
                <ExternalLink className="size-3" />
              </a>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (intent.status === "expired") {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="size-5 text-amber-500" />
              <CardTitle className="text-xl">Payment Expired</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            This payment link has expired. Please create a new one.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Amount</span>
            <span className="text-2xl font-bold">{formatAmount(intent.amount, intent.currency)}</span>
          </div>
          {intent.description && <p className="text-sm text-muted-foreground">{intent.description}</p>}
          {intent.chainConfig && <Badge variant="secondary" className="w-fit">{intent.chainConfig.name}</Badge>}
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <div className="rounded-lg border p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Provider</span>
              <span className="font-medium">{intent.providerId}</span>
            </div>
            {intent.recipient && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Recipient</span>
                <span className="font-mono text-xs">{shortenAddress(intent.recipient)}</span>
              </div>
            )}
            {intent.token && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Token</span>
                <span className="font-medium">{intent.token.symbol ?? intent.token}</span>
              </div>
            )}
          </div>
          <Button onClick={handlePay} disabled={confirming || !appKit || appKitLoading} size="lg" className="w-full">
            {confirming && <Loader2 className="size-4 animate-spin" />}
            {confirming ? "Confirming..." : appKitLoading ? "Initializing wallet..." : !appKit ? "Loading wallet..." : !connected ? "Connect Wallet" : `Pay ${formatAmount(intent.amount, intent.currency)}`}
          </Button>
          {needsConnect && !connected && (
            <p className="text-sm text-muted-foreground text-center">Connect your wallet in the modal, then click Pay.</p>
          )}
          {confirmError && (
            <p className="text-sm text-destructive">{(confirmError as Error).message}</p>
          )}
          {appKitError && (
            <p className="text-sm text-destructive">{appKitError.message}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function CheckoutRoute({ searchParams }: { searchParams: Promise<{ intentId?: string; clientSecret?: string }> }) {
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
