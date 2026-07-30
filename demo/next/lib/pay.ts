import { kuluPay } from "@kulupay/kulupay";
import { drizzleAdapter } from "@kulupay/adapter-drizzle";
import { blockchain } from "@kulupay/kulupay/providers/blockchain";
import { db } from "./db";

const EVM_RECIPIENT = (process.env.NEXT_PUBLIC_EVM_RECIPIENT_ADDRESS || "0xBBEa52F605E678c38888679986c8D1ec1710dD9F") as `0x${string}`;
const TRON_RECIPIENT = process.env.NEXT_PUBLIC_TRON_RECIPIENT_ADDRESS || "TTEc9GuWrwRNks28jLBg6fUWCLBx6uFjZK";

export const pay = kuluPay({
  database: drizzleAdapter(db, { provider: "pg" }),
  providers: blockchain({
    eth: {
      recipientAddress: EVM_RECIPIENT,
      token: "USDC",
    },
    base: {
      recipientAddress: EVM_RECIPIENT,
      token: "USDC",
    },
    tron: {
      recipientAddress: TRON_RECIPIENT,
      token: "USDT", 
    },
  }),
  baseURL: process.env.KULUPAY_URL ?? "http://localhost:3000",
  debug: true,
  auth: {
    getSession: async () => ({
      user: { id: "user_demo", name: "Demo User", email: "demo@kulupay.dev" },
      session: { id: "demo-session", userId: "user_demo", expiresAt: new Date(Date.now() + 86400000) },
    }),
  },
  pricing: {
    resolvePrice: async (data) => {
      const products: Record<string, { amount: number; currency: string; name: string }> = {
        "prod_premium": { amount: 2500, currency: "usd", name: "Premium Plan" },
        "prod_pro": { amount: 4999, currency: "usd", name: "Pro Plan" },
        "prod_starter": { amount: 999, currency: "usd", name: "Starter Plan" },
      };
      const productId = data.productId as string;
      const product = products[productId];
      if (!product) {
        throw new Error(`Product not found: ${productId}`);
      }
      return { amount: product.amount, currency: product.currency };
    },
  },
});
