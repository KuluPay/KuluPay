import { createRouter, Endpoint } from "better-call";
import type { KuluPayContext } from "@kulupay/core";
import { toKuluPayEndpoints } from "@kulupay/core/api";
import { KuluPayError } from "@kulupay/core/error";
import * as baseEndpoints from "./routes";

/**
 * Returns the API surface for KuluPay.
 * Following the Better Auth pattern: Implementation package (kulupay) 
 * defines the routes, while Core provides the transformation engine.
 */
export const getEndpoints = (ctx: KuluPayContext | Promise<KuluPayContext>) => {
    const endpoints = { 
        ...baseEndpoints,
    } as Record<string, any>;

    return {
        api: toKuluPayEndpoints(endpoints, ctx),
        endpoints,
    };
};

/**
 * Creates the main better-call router for KuluPay.
 * This router is used to handle incoming HTTP requests.
 */
export const router = (ctx: KuluPayContext) => {
    const { endpoints } = getEndpoints(ctx);
    const basePath = ctx.options.basePath || "/api/pay";

    return createRouter(endpoints, {
        routerContext: ctx,
        basePath,
        allowedMediaTypes: ["application/json"],
    });
};

export * from "./routes";
export { KuluPayError } from "@kulupay/core/error";
export { createKuluPayEndpoint, toKuluPayEndpoints } from "@kulupay/core/api";
