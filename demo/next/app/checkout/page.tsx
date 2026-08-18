"use client";

import { Suspense, use } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CheckoutPanel, CheckoutSuccess, CheckoutCanceled } from "@/components/checkout-panel";

type SearchParams = Promise<{
  intentId?: string;
  clientSecret?: string;
  success?: string;
  canceled?: string;
}>;

function CheckoutShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-[#050505] p-4 md:p-8">
      <div className="w-full max-w-5xl">
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
        <Card className="overflow-hidden border-white/10 bg-white/[0.03] text-white">
          <CheckoutSuccess
            onReset={() => {
              window.location.href = "/";
            }}
          />
        </Card>
      </CheckoutShell>
    );
  }

  if (canceled) {
    return (
      <CheckoutShell>
        <Card className="overflow-hidden border-white/10 bg-white/[0.03] text-white">
          <CheckoutCanceled
            onReset={() => {
              window.location.href = "/";
            }}
          />
        </Card>
      </CheckoutShell>
    );
  }

  if (!intentId || !clientSecret) {
    return (
      <CheckoutShell>
        <Card className="overflow-hidden border-white/10 bg-white/[0.03] text-white">
          <CardContent className="py-8 text-center">
            <p className="text-sm text-white/50">Need intentId and clientSecret query params.</p>
            <Link href="/" className="mt-4 inline-block text-sm text-white/50 hover:text-white">
              ← Back to demo
            </Link>
          </CardContent>
        </Card>
      </CheckoutShell>
    );
  }

  return (
    <CheckoutShell>
      <Card className="overflow-hidden border-white/10 bg-white/[0.03] text-white backdrop-blur-md">
        <CheckoutPanel intentId={intentId} clientSecret={clientSecret} />
      </Card>
    </CheckoutShell>
  );
}

export default function CheckoutRoute({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense
      fallback={
        <CheckoutShell>
          <Card className="overflow-hidden border-white/10 bg-white/[0.03] text-white">
            <div className="flex min-h-[320px] flex-col items-center justify-center">
              <Loader2 className="size-8 animate-spin text-indigo-400" />
              <p className="text-sm text-white/50">Loading...</p>
            </div>
          </Card>
        </CheckoutShell>
      }
    >
      <CheckoutContent searchParams={searchParams} />
    </Suspense>
  );
}
