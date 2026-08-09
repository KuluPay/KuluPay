import { toNextJsHandler } from "@kulupay/kulupay/next-js";
import { pay } from "@/lib/pay";

console.log("[kulupay] Route handler loaded, pay.handler exists:", typeof pay.handler);

const handler = toNextJsHandler(pay);

const logHandler = (method: string) => async (request: Request) => {
  const url = new URL(request.url);
  console.log(`[kulupay] ${method} ${url.pathname}${url.search}`);
  try {
    const res = await handler[method as keyof typeof handler](request);
    console.log(`[kulupay] ${method} ${url.pathname} → ${res.status}`);
    return res;
  } catch (err) {
    console.error(`[kulupay] ${method} ${url.pathname} → ERROR:`, err);
    throw err;
  }
};

export const GET = logHandler("GET");
export const POST = logHandler("POST");
export const PUT = logHandler("PUT");
export const PATCH = logHandler("PATCH");
export const DELETE = logHandler("DELETE");
