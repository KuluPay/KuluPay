import { kuluPay } from "@kulupay/kulupay";
import { drizzleAdapter } from "@kulupay/adapter-drizzle";
import { onchain } from "@kulupay/onchain";
import { db } from "./db";

export const pay = kuluPay({
  database: drizzleAdapter(db, { provider: "pg" }),
  plugins: [
    onchain({
      ethereum: {
        recipientAddress: process.env.NEXT_PUBLIC_EVM_RECIPIENT_ADDRESS as `0x${string}`,
        tokens: ["USDC", "USDT"],
        testnet: true,
      },
      base: {
        recipientAddress: process.env.NEXT_PUBLIC_EVM_RECIPIENT_ADDRESS as `0x${string}`,
        tokens: ["USDC", "USDT"],
        testnet: true,
      },
      polygon: {
        recipientAddress: process.env.NEXT_PUBLIC_EVM_RECIPIENT_ADDRESS as `0x${string}`,
        tokens: ["USDC", "USDT"],
        testnet: true,
      },
      arbitrum: {
        recipientAddress: process.env.NEXT_PUBLIC_EVM_RECIPIENT_ADDRESS as `0x${string}`,
        tokens: ["USDC", "USDT"],
        testnet: true,
      },
      tron: {
        recipientAddress: process.env.NEXT_PUBLIC_TRON_RECIPIENT_ADDRESS!,
        tokens: ["USDT"],
        testnet: true,
      },
    }),
  ],
  baseURL: process.env.KULUPAY_URL ?? "http://localhost:3000",
  checkoutUrl: "/checkout?intentId={intentId}&clientSecret={clientSecret}",
  auth: {
    getSession: async () => {
      return {
        user: { id: "demo-user", email: "demo@kulupay.dev", name: "Demo User" },
        session: { id: "demo-session" },
      };
    },
  },
  debug: process.env.NODE_ENV !== "production",
});
