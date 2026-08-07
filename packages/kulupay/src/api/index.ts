import { createRouter, Endpoint } from "better-call";
import type { KuluPayContext } from "@kulupay/core";
import {
    toKuluPayEndpoints,
    checkEndpointConflicts,
    collectPluginMiddlewares,
    originCheckMiddleware,
} from "@kulupay/core/api";
import { KuluPayError, KuluPayAPIError } from "@kulupay/core/error";
import * as baseEndpoints from "./routes";

/**
 * Returns the API surface for KuluPay.
 * Following the Better Auth pattern: Implementation package (kulupay)
 * defines the routes, while Core provides the transformation engine.
 *
 * Also collects plugin middlewares and checks for endpoint conflicts.
 */
export const getEndpoints = (ctx: KuluPayContext | Promise<KuluPayContext>) => {
    const endpoints = {
        ...baseEndpoints,
    } as Record<string, any>;

    return {
        api: toKuluPayEndpoints(endpoints, ctx),
        endpoints,
        middlewares: collectPluginMiddlewares(ctx, getPluginsSync(ctx)),
    };
};

/**
 * Helper to get plugins synchronously from a possibly-promise context.
 * If ctx is a Promise, returns empty array (middlewares will be collected later).
 */
function getPluginsSync(ctx: KuluPayContext | Promise<KuluPayContext>): any[] {
    if (ctx instanceof Promise) return [];
    return ctx.plugins || [];
}

/**
 * Creates the main better-call router for KuluPay.
 * This router is used to handle incoming HTTP requests.
 *
 * Mirrors better-auth's router pattern:
 * - Applies originCheckMiddleware globally via routerMiddleware
 * - Merges plugin middlewares into the middleware chain
 * - Supports plugin onRequest/onResponse hooks
 * - Supports rate limiting via onRequest hook
 * - Filters out SERVER_ONLY endpoints from HTTP routing
 * - Supports disabledPaths
 * - onError handler for centralized error logging
 */
export const router = (ctx: KuluPayContext) => {
    const { endpoints, middlewares } = getEndpoints(ctx);
    const basePath = ctx.options.basePath || "/api/pay";

    // Filter out server-only endpoints from the HTTP router
    const httpEndpoints: Record<string, Endpoint> = {};
    for (const [key, endpoint] of Object.entries(endpoints)) {
        const ep = endpoint as any;
        if (ep?.options?.metadata?.SERVER_ONLY) continue;
        httpEndpoints[key] = ep as Endpoint;
    }

    // Check for endpoint conflicts between base and plugin endpoints
    checkEndpointConflicts(httpEndpoints, ctx.plugins || [], ctx.logger);

    // Build rate limiter if configured
    const rateLimitConfig = ctx.plugins?.find((p: any) => p.rateLimit)?.rateLimit;
    const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

    const disabledPaths = (ctx.options as any).disabledPaths as string[] | undefined;

    return createRouter(httpEndpoints, {
        routerContext: ctx,
        basePath,
        allowedMediaTypes: ["application/json"],
        routerMiddleware: [
            { path: "/**", middleware: originCheckMiddleware },
            ...middlewares,
        ],
        async onRequest(req: Request) {
            // Handle disabled paths
            if (disabledPaths && disabledPaths.length > 0) {
                const url = new URL(req.url);
                const normalizedPath = url.pathname.replace(basePath, "");
                if (disabledPaths.includes(normalizedPath)) {
                    return new Response("Not Found", { status: 404 });
                }
            }

            // Run plugin onRequest hooks
            let currentRequest = req;
            for (const plugin of ctx.options.plugins || []) {
                if (plugin.onRequest) {
                    const result = await plugin.onRequest(currentRequest, ctx);
                    if (result && "response" in result) {
                        return result.response;
                    }
                    if (result && "request" in result) {
                        currentRequest = result.request;
                    }
                }
            }

            // Rate limiting
            if (rateLimitConfig) {
                const key = rateLimitConfig.keyGenerator
                    ? await rateLimitConfig.keyGenerator(currentRequest)
                    : currentRequest.headers.get("x-forwarded-for") || "unknown";
                const now = Date.now();
                const windowMs = rateLimitConfig.window * 1000;
                const entry = rateLimitStore.get(key);
                if (!entry || now > entry.resetAt) {
                    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
                } else {
                    entry.count++;
                    if (entry.count > rateLimitConfig.max) {
                        return new Response(
                            JSON.stringify({
                                error: {
                                    code: "RATE_LIMIT_EXCEEDED",
                                    message: "Too many requests. Please try again later.",
                                },
                            }),
                            {
                                status: 429,
                                headers: {
                                    "Content-Type": "application/json",
                                    "Retry-After": String(Math.ceil((entry.resetAt - now) / 1000)),
                                },
                            },
                        );
                    }
                }
            }

            return currentRequest;
        },
        async onResponse(res: Response, req: Request) {
            // Run plugin onResponse hooks
            for (const plugin of ctx.options.plugins || []) {
                if (plugin.onResponse) {
                    const result = await plugin.onResponse(res, ctx);
                    if (result && result.response) {
                        return result.response;
                    }
                }
            }
            return res;
        },
        onError(e: any) {
            if (e instanceof KuluPayAPIError && e.statusCode === 302) {
                return;
            }
            if (e && typeof e === "object" && "message" in e) {
                ctx.logger.error(e.message, e);
            } else {
                ctx.logger.error("Unhandled router error", e);
            }
        },
    });
};

export * from "./routes";
export { KuluPayError, KuluPayAPIError } from "@kulupay/core/error";
export {
    createKuluPayEndpoint,
    createKuluPayServerEndpoint,
    createKuluPayMiddleware,
    toKuluPayEndpoints,
    checkEndpointConflicts,
    collectPluginMiddlewares,
} from "@kulupay/core/api";
