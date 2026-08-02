import { kuluPay } from "@kulupay/kulupay";
import { evm, tron, CHAINS, TOKENS } from "@kulupay/kulupay/providers/blockchain";
import { drizzleAdapter } from "@kulupay/adapter-drizzle";
import { db } from "./db";

export const pay = kuluPay({
  database: drizzleAdapter(db, { provider: "pg" }),
  providers: [
    evm({
      chain: CHAINS.ethereum,
      recipientAddress: process.env.NEXT_PUBLIC_EVM_RECIPIENT_ADDRESS as `0x${string}`,
      id: "evm-eth",
    }),
  ],
  baseURL: process.env.KULUPAY_URL ?? "http://localhost:3000",
  debug: true,
});
