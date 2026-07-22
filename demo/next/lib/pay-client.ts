import { createKuluPayClient } from "@kulupay/kulupay/client";

export const payClient = createKuluPayClient({
  baseURL: "/api/pay",
});


import { createStripeClientProvider } from "@kulupay/kulupay/client/providers";

export const stripeProvider = createStripeClientProvider({
  publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "",
});
