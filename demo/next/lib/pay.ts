import { kuluPay, PaymentProvider, PaymentIntent } from "@kulupay/kulupay";
import { createMemoryDriver } from "@farming-labs/orm";

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

export const pay = kuluPay({
  database: createMemoryDriver(),
  providers: [mockProvider],
  baseURL: process.env.KULUPAY_URL ?? "http://localhost:3000/api/pay",
  debug: true,
});
