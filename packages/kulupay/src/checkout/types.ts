import type { CheckoutFlow } from "@kulupay/core";

/** Minimal interface that the checkout components need from the PayClient. */
export interface PayClientLike {
  checkoutIntent: (opts: { intentId: string; clientSecret: string }) => Promise<{ data: any; error: any }>;
  confirmIntent: (opts: { body: { intentId: string; txHash: string; clientSecret: string } }) => Promise<{ data: any; error: any }>;
  verifyIntent: (opts: { intentId: string; clientSecret: string }) => Promise<{ data: any; error: any }>;
}

export interface CheckoutIntentData {
  id: string;
  amount: number;
  currency: string;
  status: string;
  providerId: string;
  checkoutFlow: CheckoutFlow;
  clientSecret: string;
  txHash: string | null;
  metadata: any;
  type: string;
  description: string | null;
  raw: any;
  deadline: number | null;
  recipient: string | null;
  token: any;
  network: any;
  signature: string | null;
  contractAddress: string | null;
}

export interface CheckoutProps {
  intent: CheckoutIntentData;
  client: PayClientLike;
  onStartPolling: () => void;
  onUpdateStatus: (status: string, txHash?: string) => void;
}

export function formatAmount(cents: number, currency: string): string {
  const value = cents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(value);
}

export function formatTokenAmount(rawAmount: string, decimals: number): string {
  const value = BigInt(rawAmount) / BigInt(10 ** decimals);
  const remainder = BigInt(rawAmount) % BigInt(10 ** decimals);
  const intPart = value.toString();
  const decPart = remainder.toString().padStart(decimals, "0").slice(0, 4);
  return `${intPart}.${decPart}`;
}

export function shortenAddress(addr: string, chars = 6): string {
  if (!addr) return "";
  return `${addr.slice(0, chars)}...${addr.slice(-4)}`;
}

export function timeRemaining(deadline: number): { mins: number; secs: number; total: number } {
  const total = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
  return {
    mins: Math.floor(total / 60),
    secs: total % 60,
    total,
  };
}
