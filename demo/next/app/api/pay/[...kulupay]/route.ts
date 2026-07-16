import { toNextJsHandler } from "@kulupay/kulupay/next-js";
import { pay } from "@/lib/pay";

export const { GET, POST, PUT, PATCH, DELETE } = toNextJsHandler(pay);
