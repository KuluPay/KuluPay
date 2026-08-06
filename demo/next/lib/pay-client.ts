import { createPayClient } from "@kulupay/kulupay/client";

export const payClient = createPayClient({
  baseURL: "",
  basePath: "/api/pay",
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
});
