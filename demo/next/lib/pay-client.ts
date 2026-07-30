import { createPayClient } from "@kulupay/kulupay/client";

export const payClient = createPayClient({
  baseURL: "http://localhost:3000",
});
