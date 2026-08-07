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
        testnet: false,
      },
      base: {
        recipientAddress: process.env.NEXT_PUBLIC_EVM_RECIPIENT_ADDRESS as `0x${string}`,
        tokens: ["USDC", "USDT"],
        testnet: false,
      },
      polygon: {
        recipientAddress: process.env.NEXT_PUBLIC_EVM_RECIPIENT_ADDRESS as `0x${string}`,
        tokens: ["USDC", "USDT"],
        testnet: false,
      },
      arbitrum: {
        recipientAddress: process.env.NEXT_PUBLIC_EVM_RECIPIENT_ADDRESS as `0x${string}`,
        tokens: ["USDC", "USDT"],
        testnet: false,
      },
      tron: {
        recipientAddress: process.env.NEXT_PUBLIC_TRON_RECIPIENT_ADDRESS!,
        tokens: ["USDT"],
        testnet: false,
      },
    }),
  ],
  baseURL: process.env.KULUPAY_URL ?? "http://localhost:3000",
  trustedOrigins: ["http://localhost:3000"],
  auth: {
    getSession: async () => {
      return {
        user: { id: "demo-user", email: "demo@kulupay.dev", name: "Demo User" },
        session: { id: "demo-session" },
      };
    },
  },
  debug: true,
});
