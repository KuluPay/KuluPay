import { createPayClient } from "@kulupay/kulupay/client";
import { onchainClient } from "@kulupay/onchain/client";

export const payClient = createPayClient({
  baseURL: process.env.NEXT_PUBLIC_KULUPAY_URL ?? "http://localhost:3000",
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
  plugins: [
    onchainClient({
      walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
    }),
  ],
});
