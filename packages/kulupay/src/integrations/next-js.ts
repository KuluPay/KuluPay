import type { KuluPayContext } from "@kulupay/core";

export interface KuluPayNextJsHandler {
    GET: (request: Request) => Promise<Response>;
    POST: (request: Request) => Promise<Response>;
    PUT: (request: Request) => Promise<Response>;
    PATCH: (request: Request) => Promise<Response>;
    DELETE: (request: Request) => Promise<Response>;
}

/**
 * Converts the KuluPay request handler into a Next.js Route Handler object.
 * Works with the App Router (`route.ts`) and the Pages Router (`[...kulupay].ts`).
 */
export function toNextJsHandler(
    kuluPay:
        | { handler: (request: Request) => Promise<Response> }
        | ((request: Request) => Promise<Response>),
): KuluPayNextJsHandler {
    const handler = async (request: Request) => {
        return "handler" in kuluPay ? kuluPay.handler(request) : kuluPay(request);
    };

    return {
        GET: handler,
        POST: handler,
        PUT: handler,
        PATCH: handler,
        DELETE: handler,
    };
}

/**
 * Helper to call the KuluPay API from server-side Next.js code
 * (Server Components, Server Actions, or `getServerSideProps`).
 */
export async function fromKuluPay<T = any>(
    context: Promise<KuluPayContext>,
    action: (ctx: KuluPayContext) => Promise<T>,
): Promise<T> {
    const ctx = await context;
    return action(ctx);
}
