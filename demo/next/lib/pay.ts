import { kuluPay, createPgPoolDriver } from "@kulupay/kulupay";
import { stripe } from "@kulupay/kulupay/providers/stripe";
import { Pool } from "pg";

const database = createPgPoolDriver(
  new Pool({ connectionString: process.env.DATABASE_URL! }),
);

export const pay = kuluPay({
  database,
  providers: [
    stripe({
      apiKey: process.env.STRIPE_API_KEY!,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
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
      const productId = data.metadata?.productId as string;
      const product = products[productId];
      if (!product) {
        throw new Error(`Product not found: ${productId}`);
      }
      return { amount: product.amount, currency: product.currency };
    },
  },
});
