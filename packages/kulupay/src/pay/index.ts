import type { KuluPayContext, KuluPayOptions } from "@kulupay/core";
import { init, getTrustedOrigins } from "@kulupay/core/context";
import { KuluPayError, KuluPayAPIError } from "@kulupay/core/error";
import {
    getOrigin,
    isDynamicBaseURLConfig,
    resolveBaseURL,
} from "@kulupay/core/utils";
import { getEndpoints, router } from "../api";

/**
 * Initializes KuluPay with the given options.
 */
export const kuluPay = <Options extends KuluPayOptions>(options: Options) => {
    return createKuluPay(options, init);
};

/**
 * Main entry point for KuluPay.
 * Following the Better Auth pattern, it takes options and an initialization function.
 * It returns the request handler, the API object, and other core properties.
 */
export const createKuluPay = <Options extends KuluPayOptions>(
	options: Options,
	initFn: (options: Options) => Promise<KuluPayContext>,
) => {
    // Resolve the core context once (async)
	const contextPromise = initFn(options);
    
    // Pre-calculate the API surface
	const { api } = getEndpoints(contextPromise);
    
	return {
        /**
         * Main request handler for HTTP requests.
         * Handles baseURL resolution and routes the request to the internal better-call router.
         */
		handler: async (request: Request) => {
			const ctx = await contextPromise;
			const basePath = options.basePath || "/api/pay";

			let handlerCtx: KuluPayContext;

            /**
             * DYNAMIC BASE URL HANDLING
             * If the baseURL is dynamic (e.g. wildcard subdomains), we create a 
             * request-specific context to avoid mutation race conditions.
             */
			if (isDynamicBaseURLConfig(options.baseURL)) {
				handlerCtx = Object.create(
					Object.getPrototypeOf(ctx),
					Object.getOwnPropertyDescriptors(ctx),
				) as KuluPayContext;
				const baseURL = resolveBaseURL(options.baseURL, basePath, request);
				if (baseURL) {
					handlerCtx.baseURL = baseURL;
					handlerCtx.options = {
						...ctx.options,
						baseURL: getOrigin(baseURL) || undefined,
					};
				} else {
					throw new KuluPayError(
						"Could not resolve base URL from request. Check your allowedHosts config.",
					);
				}
				handlerCtx.trustedOrigins = await getTrustedOrigins(
					handlerCtx.options,
					request,
				);
			} else {
                /**
                 * STATIC BASE URL HANDLING
                 * If the baseURL is static or needs to be inferred once from the first request.
                 */
				handlerCtx = ctx;
				if (!ctx.options.baseURL) {
					const baseURL = resolveBaseURL(
						undefined,
						basePath,
						request
					);
					if (baseURL) {
						ctx.baseURL = baseURL;
						ctx.options.baseURL = getOrigin(ctx.baseURL) || undefined;
					} else {
						throw new KuluPayError(
							"Could not get base URL from request. Please provide a valid base URL.",
						);
					}
				}
				handlerCtx.trustedOrigins = await getTrustedOrigins(
					ctx.options,
					request,
				);
			}

            // Route the request using the better-call router
			const { handler } = router(handlerCtx);
			try {
				return await handler(request);
			} catch (error) {
				const apiError =
					error instanceof KuluPayAPIError
						? error
						: error && typeof error === "object" && "statusCode" in error && "body" in error
							? (error as KuluPayAPIError)
							: null;
				if (apiError) {
					return new Response(JSON.stringify(apiError.body), {
						status: apiError.statusCode,
						headers: { "Content-Type": "application/json" },
					});
				}
				throw error;
			}
		},
        /**
         * The server-side API object.
         * Allows calling KuluPay functions directly in server-side code.
         */
		api: api as any,
		options: options,
		$context: contextPromise,
	};
};
