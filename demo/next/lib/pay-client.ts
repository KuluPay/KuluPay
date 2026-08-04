import { createPayClient } from "@kulupay/kulupay/client";

export const payClient = createPayClient({
  baseURL: "",
  basePath: "/api/pay",
});
