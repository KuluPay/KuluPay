import { createPayClient } from "@kulupay/kulupay/client";

export const payClient = createPayClient({

  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
});
