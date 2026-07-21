import { kuluPay, PaymentProvider, PaymentIntent } from "@kulupay/kulupay";
import { createPgPoolDriver } from "@farming-labs/orm-sql";
import { Pool } from "@neondatabase/serverless";

const mockProvider: PaymentProvider = {
  id: "mock",
  createIntent: async (data) => {
    return {
      id: `mock_${Date.now()}`,
      amount: data.amount,
      currency: data.currency,
      status: "pending",
      metadata: data.metadata,
    } as PaymentIntent;
  },
  getIntent: async (id) => ({
    id,
    amount: 1000,
    currency: "USD",
    status: "succeeded",
  }),
  cancelIntent: async (id) => ({
    id,
    amount: 1000,
    currency: "USD",
    status: "canceled",
  }),
};

const connectionString = process.env.DATABASE_URL!;

export const pay = kuluPay({
  database: createPgPoolDriver(new Pool({ connectionString })),
  providers: [mockProvider],
  baseURL: process.env.KULUPAY_URL ?? "http://localhost:3000",
  debug: true,
});
