import { createKuluPayClient } from "@kulupay/kulupay/client";

export const payClient = createKuluPayClient({
  baseURL: "/api/pay",
});
