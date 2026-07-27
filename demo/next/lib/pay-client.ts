import { createPayClient } from "@kulupay/kulupay/client";

export const payClient = createPayClient({
  baseURL: "/api/pay",
});

import { createStripeClientProvider } from "@kulupay/kulupay/client/providers";
import { createEVMClientProvider } from "@kulupay/kulupay/client/providers";
import { createTronClientProvider } from "@kulupay/kulupay/client/providers";

export const stripeProvider = createStripeClientProvider({
  publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "",
});

// Base USDC
export const baseUsdcProvider = createEVMClientProvider({
  id: "evm-base-usdc",
  chainId: 8453,
  recipientAddress: (process.env.NEXT_PUBLIC_EVM_RECIPIENT_ADDRESS ?? "0x0") as `0x${string}`,
  tokenContractAddress: (process.env.NEXT_PUBLIC_BASE_USDC_CONTRACT ?? "0x0") as `0x${string}`,
  tokenDecimals: 6,
});

// Native ETH
export const ethProvider = createEVMClientProvider({
  id: "evm-eth",
  chainId: 1,
  recipientAddress: (process.env.NEXT_PUBLIC_EVM_RECIPIENT_ADDRESS ?? "0x0") as `0x${string}`,
});

// Tron USDT
export const tronUsdtProvider = createTronClientProvider({
  id: "tron-usdt",
  recipientAddress: process.env.NEXT_PUBLIC_TRON_RECIPIENT_ADDRESS ?? "T...",
  tokenContractAddress: process.env.NEXT_PUBLIC_TRON_USDT_CONTRACT,
  tokenDecimals: 6,
});

// Native TRX
export const tronTrxProvider = createTronClientProvider({
  id: "tron-trx",
  recipientAddress: process.env.NEXT_PUBLIC_TRON_RECIPIENT_ADDRESS ?? "T...",
});
