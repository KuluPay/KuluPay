import { kuluPay } from "@kulupay/kulupay";
import { pg } from "@kulupay/adapter-sql";
import { stripe } from "@kulupay/kulupay/providers/stripe";
import { evm, tron, CHAINS, TOKENS } from "@kulupay/kulupay/providers/blockchain";
import { Pool } from "pg";

const database = pg(
  new Pool({ connectionString: process.env.DATABASE_URL! }),
);

export const pay = kuluPay({
  database,
  providers: [
    stripe({
      apiKey: process.env.STRIPE_API_KEY!,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    }),
    // ─── Base USDC (EVM) ───
    evm({
      chain: CHAINS.base,
      recipientAddress: process.env.NEXT_PUBLIC_EVM_RECIPIENT_ADDRESS as `0x${string}`,
      token: TOKENS.USDC(process.env.NEXT_PUBLIC_BASE_USDC_CONTRACT!),
      id: "evm-base-usdc",
    }),
    // ─── Ethereum native ETH ───
    evm({
      chain: CHAINS.ethereum,
      recipientAddress: process.env.NEXT_PUBLIC_EVM_RECIPIENT_ADDRESS as `0x${string}`,
      id: "evm-eth",
    }),
    // ─── Tron USDT (TRC-20) ───
    tron({
      chain: CHAINS.tron,
      recipientAddress: process.env.NEXT_PUBLIC_TRON_RECIPIENT_ADDRESS!,
      token: {
        symbol: "USDT",
        decimals: 6,
        contractAddress: process.env.NEXT_PUBLIC_TRON_USDT_CONTRACT!,
      },
      id: "tron-usdt",
    }),
    // ─── Tron native TRX ───
    tron({
      chain: CHAINS.tron,
      recipientAddress: process.env.NEXT_PUBLIC_TRON_RECIPIENT_ADDRESS!,
      id: "tron-trx",
    }),
  ],
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
