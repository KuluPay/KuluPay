import { 
    createEndpoint, 
    createMiddleware,
    Endpoint, 
    HTTPMethod, 
    EndpointContext, 
    EndpointMetadata, 
    StandardSchemaV1, 
    ResolveBodyInput, 
    ResolveQueryInput, 
    ResolveMetaInput, 
    ResolveErrorInput,
    Middleware,
    InputContext
} from "better-call";
import { KuluPayContext, KuluPayPlugin } from "../types";
import { kuluPayContextStore } from "../async_hooks";
import { KuluPayAPIError } from "../error";

/**
 * Symbol used to attach response headers to an APIError when it's thrown,
 * so the outer pipeline can merge them into the final response.
 * Mirrors better-auth's kAPIErrorHeaderSymbol pattern.
 */
const kResponseHeadersSymbol = Symbol("responseHeaders");

/**
 * Attaches response headers to an APIError if applicable.
 */
function attachResponseHeadersToAPIError(
    responseHeaders: Headers | undefined,
    e: unknown,
): void {
    if (!(e instanceof KuluPayAPIError) || !responseHeaders) return;
    Object.defineProperty(e, kResponseHeadersSymbol, {
        enumerable: false,
        configurable: true,
        value: responseHeaders,
        writable: false,
    });
}

/**
 * Extracts attached response headers from an APIError, if any.
 */
export function getResponseHeadersFromError(e: unknown): Headers | undefined {
    if (e && typeof e === "object" && kResponseHeadersSymbol in e) {
        return (e as any)[kResponseHeadersSymbol];
    }
    return undefined;
}

/**
 * Normalized method type for better-call
 */
type NormalizeMethod<M> = M extends readonly (infer E)[] ? E[] : M;

/**
 * Helper to create a KuluPay endpoint.
 * This wraps `createEndpoint` from `better-call` and ensures that the
 * KuluPay context is available within the handler using AsyncLocalStorage.
 */
export const createKuluPayEndpoint = <
	Path extends string,
	const Method extends HTTPMethod | HTTPMethod[] | "*",
	BodySchema extends object | undefined = undefined,
	QuerySchema extends object | undefined = undefined,
	Use extends Middleware[] = [],
	ReqHeaders extends boolean = false,
	ReqRequest extends boolean = false,
	R = unknown,
	Meta extends EndpointMetadata | undefined = undefined,
	ErrorSchema extends StandardSchemaV1 | undefined = undefined,
>(
	path: Path,
	options: { method: Method } & {
		query?: QuerySchema;
		use?: [...Use];
		requireHeaders?: ReqHeaders;
		requireRequest?: ReqRequest;
		error?: ErrorSchema;
		metadata?: Meta;
	},
	handler: (
		ctx: EndpointContext<
			Path,
			Method,
			BodySchema,
			QuerySchema,
			Use,
			ReqHeaders,
			ReqRequest,
			KuluPayContext,
			Meta
		>,
	) => Promise<R>,
): Endpoint<
	Path,
	NormalizeMethod<Method>,
	ResolveBodyInput<BodySchema, Meta>,
	ResolveQueryInput<QuerySchema, Meta>,
	Use,
	R,
	ResolveMetaInput<Meta>,
	ResolveErrorInput<ErrorSchema, Meta>
> => {
	return createEndpoint(
		path,
		options as any,
		async (ctx: any) => {
            const runtimeCtx = ctx as any;
            try {
                return await kuluPayContextStore.run(ctx.context, () => handler(ctx));
            } catch (error) {
                attachResponseHeadersToAPIError(runtimeCtx.responseHeaders, error);
                const apiError =
                    error instanceof KuluPayAPIError
                        ? error
                        : error && typeof error === "object" && "statusCode" in error && "body" in error
                            ? (error as KuluPayAPIError)
                            : null;
                if (apiError) {
                    const headers: Record<string, string> = { "Content-Type": "application/json" };
                    const attached = getResponseHeadersFromError(error);
                    if (attached) {
                        attached.forEach((value, key) => {
                            if (key.toLowerCase() !== "content-type") {
                                headers[key] = value;
                            }
                        });
                    }
                    return new Response(JSON.stringify(apiError.body), {
                        status: apiError.statusCode,
                        headers,
                    });
                }
                throw error;
            }
        }
    ) as any;
};

/**
 * Create a server-only endpoint — callable via `pay.api.*` but never
 * registered on the HTTP router. Mirrors better-auth's server-only endpoints.
 *
 * @example
 * ```ts
 * const internalStats = createKuluPayServerEndpoint(
 *   { method: "POST" },
 *   async (ctx) => { return { total: 42 }; }
 * );
 * // Call from server code: const result = await pay.api.internalStats();
 * // NOT accessible via HTTP
 * ```
 */
export function createKuluPayServerEndpoint<
    Options extends { method: HTTPMethod | HTTPMethod[] | "*" },
    R = unknown,
>(
    options: Options,
    handler: (ctx: any) => Promise<R>,
) {
    const endpoint = createEndpoint(
        {
            ...options,
            metadata: { ...(options as any).metadata, SERVER_ONLY: true },
        } as any,
        async (ctx: any) => {
            try {
                return await kuluPayContextStore.run(ctx.context, () => handler(ctx));
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
        }
    ) as any;
    (endpoint as any).options = (endpoint as any).options || {};
    (endpoint as any).options.metadata = { ...((endpoint as any).options.metadata || {}), SERVER_ONLY: true };
    return endpoint;
}

/**
 * Create a KuluPay middleware — mirrors better-auth's `createAuthMiddleware`.
 *
 * Wraps `createMiddleware` from `better-call` and ensures the KuluPay
 * context is available via AsyncLocalStorage.
 *
 * @example
 * ```ts
 * const logMiddleware = createKuluPayMiddleware(async (ctx) => {
 *   console.log(`${ctx.method} ${ctx.path}`);
 * });
 * ```
 */
export const createKuluPayMiddleware = createMiddleware.create({
    use: [
        createMiddleware(async () => {
            return {} as KuluPayContext;
        }),
    ],
});

/**
 * Checks endpoint conflicts between base endpoints and plugin endpoints.
 * Mirrors better-auth's `checkEndpointConflicts`.
 */
export function checkEndpointConflicts(
    baseEndpoints: Record<string, Endpoint>,
    plugins: KuluPayPlugin[],
    logger?: { error: (msg: string, ...args: any[]) => void },
): void {
    const endpointRegistry = new Map<string, { pluginId: string; endpointKey: string; methods: string[] }[]>();

    // Register base endpoints
    for (const [key, endpoint] of Object.entries(baseEndpoints)) {
        if (endpoint && "path" in endpoint && typeof endpoint.path === "string") {
            const path = endpoint.path;
            let methods: string[] = [];
            if (endpoint.options && "method" in endpoint.options) {
                if (Array.isArray(endpoint.options.method)) {
                    methods = endpoint.options.method;
                } else {
                    methods = [endpoint.options.method];
                }
            }
            endpointRegistry.set(path, [{ pluginId: "core", endpointKey: key, methods }]);
        }
    }

    // Check plugin endpoints for conflicts
    for (const plugin of plugins) {
        if (!plugin.endpoints) continue;
        for (const [key, endpoint] of Object.entries(plugin.endpoints)) {
            if (endpoint && "path" in endpoint && typeof endpoint.path === "string") {
                const path = endpoint.path;
                let methods: string[] = [];
                if (endpoint.options && "method" in endpoint.options) {
                    if (Array.isArray(endpoint.options.method)) {
                        methods = endpoint.options.method;
                    } else {
                        methods = [endpoint.options.method];
                    }
                }
                const existing = endpointRegistry.get(path) || [];
                const conflict = existing.find((e) =>
                    e.methods.some((m) => methods.includes(m))
                );
                if (conflict) {
                    const msg = `Endpoint conflict: plugin "${plugin.id}" defines ${methods.join(",")} ${path} which conflicts with "${conflict.pluginId}" endpoint "${conflict.endpointKey}"`;
                    if (logger) {
                        logger.error(msg);
                    }
                    throw new Error(msg);
                }
                existing.push({ pluginId: plugin.id, endpointKey: key, methods });
                endpointRegistry.set(path, existing);
            }
        }
    }
}

/**
 * Collects middlewares from plugins, wrapping them with context injection.
 * Mirrors better-auth's plugin middleware collection.
 */
export function collectPluginMiddlewares(
    ctx: KuluPayContext | Promise<KuluPayContext>,
    plugins: KuluPayPlugin[],
): { path: string; middleware: Middleware }[] {
    return plugins
        .flatMap((plugin) =>
            plugin.middlewares?.map((m) => {
                const middleware = (async (context: any) => {
                    const kuluPayContext = await ctx;
                    return m.middleware({
                        ...context,
                        context: {
                            ...kuluPayContext,
                            ...context.context,
                        },
                    });
                }) as Middleware;
                middleware.options = m.middleware.options;
                return { path: m.path, middleware };
            }) || [],
        )
        .filter((m) => m !== undefined);
}

type UserInputContext = Partial<
	InputContext<string, any, any, any, any, any> &
		EndpointContext<string, any, any, any, any, any, any, any>
>;

type Hook = {
    matcher: (context: any) => boolean;
    handler: (context: any) => Promise<unknown>;
};

/**
 * Collect before/after hooks from plugins and user-defined hooks.
 * Mirrors better-auth's getHooks.
 */
function getHooks(ctx: KuluPayContext) {
    const plugins = ctx.options.plugins || [];
    const beforeHooks: Hook[] = [];
    const afterHooks: Hook[] = [];

    for (const plugin of plugins) {
        if (plugin.hooks?.before) {
            for (const h of plugin.hooks.before) {
                beforeHooks.push({ matcher: h.matcher, handler: h.handler });
            }
        }
        if (plugin.hooks?.after) {
            for (const h of plugin.hooks.after) {
                afterHooks.push({ matcher: h.matcher, handler: h.handler });
            }
        }
    }

    return { beforeHooks, afterHooks };
}

/**
 * Run before hooks. If a hook returns a response, short-circuit.
 * If it returns { context }, merge into the internal context.
 */
async function runBeforeHooks(
    internalContext: any,
    hooks: Hook[],
): Promise<{ context: any } | any> {
    let modifiedContext: any = {};

    for (const hook of hooks) {
        let matched = false;
        try {
            matched = hook.matcher(internalContext);
        } catch {
            continue;
        }
        if (matched) {
            const result = await hook.handler({
                ...internalContext,
                returnHeaders: false,
            });
            if (result && typeof result === "object") {
                if ("context" in result && typeof result.context === "object") {
                    modifiedContext = { ...modifiedContext, ...result.context };
                    continue;
                }
                return result;
            }
        }
    }
    return { context: modifiedContext };
}

/**
 * Run after hooks. Merge response headers and allow response replacement.
 */
async function runAfterHooks(
    internalContext: any,
    hooks: Hook[],
): Promise<{ response: any; headers: Headers | null }> {
    for (const hook of hooks) {
        if (hook.matcher(internalContext)) {
            const result: any = await hook.handler(internalContext).catch((e) => {
                if (e instanceof KuluPayAPIError) {
                    return {
                        response: e,
                        headers: e.headers ? new Headers(e.headers) : null,
                    };
                }
                throw e;
            });
            if (result && typeof result === "object" && "response" in result) {
                internalContext.context.returned = result.response;
                if (result.headers) {
                    if (!internalContext.context.responseHeaders) {
                        internalContext.context.responseHeaders = new Headers();
                    }
                    result.headers.forEach((value: string, key: string) => {
                        if (key.toLowerCase() === "set-cookie") {
                            internalContext.context.responseHeaders.append(key, value);
                        } else {
                            internalContext.context.responseHeaders.set(key, value);
                        }
                    });
                }
            }
        }
    }
    return {
        response: internalContext.context.returned,
        headers: internalContext.context.responseHeaders,
    };
}

/**
 * Transforms better-call endpoints into a user-friendly API object.
 * Executes before/after hooks from plugins around each endpoint call.
 * Mirrors better-auth's toAuthEndpoints.
 */
export function toKuluPayEndpoints<const E extends Record<string, Endpoint>>(
	endpoints: E,
	ctx: KuluPayContext | Promise<KuluPayContext>,
): E {
	const api: any = {};

    const wrapEndpoint = (endpoint: Endpoint, context: KuluPayContext | Promise<KuluPayContext>) => {
        const wrapped = async (input?: UserInputContext) => {
            const kuluPayContext = await context;
            const { beforeHooks, afterHooks } = getHooks(kuluPayContext);

            const isContext = input && (input.request || input.headers || input.body || input.query);
            const internalContext: any = isContext ? { ...input } : {
                body: input,
                query: input,
                params: input,
                ...input,
            };
            internalContext.context = {
                ...kuluPayContext,
                returned: undefined,
                responseHeaders: undefined,
                session: null,
            };
            internalContext.path = endpoint.path;
            internalContext.asResponse = input?.asResponse ?? !!input?.request;
            internalContext.returnHeaders = true;
            internalContext.returnStatus = true;

            // Run before hooks
            const before = await runBeforeHooks(internalContext, beforeHooks);
            if (before && typeof before === "object" && "context" in before && before.context) {
                internalContext.context = { ...internalContext.context, ...before.context };
            } else if (before && typeof before === "object" && !("context" in before)) {
                // Short-circuit: hook returned a response
                return internalContext.asResponse ? before : before;
            }

            // Execute endpoint
            let result: any;
            try {
                result = await kuluPayContextStore.run(kuluPayContext, () =>
                    (endpoint as any)(internalContext),
                );
            } catch (e: any) {
                if (e instanceof KuluPayAPIError) {
                    result = {
                        response: e,
                        status: e.statusCode,
                        headers: e.headers ? new Headers(e.headers) : null,
                    };
                } else {
                    throw e;
                }
            }

            if (result instanceof Response) {
                return result;
            }

            internalContext.context.returned = result?.response ?? result;
            internalContext.context.responseHeaders = result?.headers;

            // Run after hooks
            const after = await runAfterHooks(internalContext, afterHooks);

            const shouldReturnResponse = internalContext.asResponse;
            if (shouldReturnResponse) {
                const headers = after.headers || new Headers();
                return new Response(
                    typeof after.response === "string" ? after.response : JSON.stringify(after.response),
                    {
                        status: result?.status ?? 200,
                        headers,
                    },
                );
            }

            if (internalContext.returnHeaders) {
                return internalContext.returnStatus
                    ? { headers: after.headers, response: after.response, status: result?.status }
                    : { headers: after.headers, response: after.response };
            }

            return internalContext.returnStatus
                ? { response: after.response, status: result?.status }
                : after.response;
        };
        (wrapped as any).path = endpoint.path;
        (wrapped as any).options = endpoint.options;
        return wrapped;
    };

	for (const [key, endpoint] of Object.entries(endpoints)) {
		api[key] = wrapEndpoint(endpoint, ctx);
	}

    // Add plugin endpoints (from both KuluPayPlugin[] and provider.endpoints)
    const addPluginEndpoints = async () => {
        const kuluPayContext = await ctx;

        // 1. Merge endpoints from KuluPayPlugin[]
        for (const plugin of kuluPayContext.plugins) {
            if (plugin.endpoints) {
                for (const [key, endpoint] of Object.entries(plugin.endpoints)) {
                    api[key] = wrapEndpoint(endpoint as any, ctx);
                }
            }
        }

        // 2. Merge endpoints from providers (legacy compatibility)
        for (const provider of kuluPayContext.providers.values()) {
            const providerWithEndpoints = provider as any;
            if (providerWithEndpoints.endpoints) {
                for (const [key, endpoint] of Object.entries(providerWithEndpoints.endpoints)) {
                    api[key] = wrapEndpoint(endpoint as any, ctx);
                }
            }
            if (providerWithEndpoints.actions) {
                api[provider.id] = providerWithEndpoints.actions;
            }
        }
    };

    addPluginEndpoints();

	return api as E;
}

export * from "./middleware";
 