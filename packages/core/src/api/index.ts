import { 
    createEndpoint, 
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
import { KuluPayContext } from "../types";
import { kuluPayContextStore } from "../async_hooks";

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
            return kuluPayContextStore.run(ctx.context, () => handler(ctx));
        }
	) as any;
};

type UserInputContext = Partial<
	InputContext<string, any, any, any, any, any> &
		EndpointContext<string, any, any, any, any, any, any, any>
>;

/**
 * Transforms better-call endpoints into a user-friendly API object.
 */
export function toKuluPayEndpoints<const E extends Record<string, Endpoint>>(
	endpoints: E,
	ctx: KuluPayContext | Promise<KuluPayContext>,
): E {
	const api: any = {};

    // Helper to wrap an endpoint
    const wrapEndpoint = (endpoint: Endpoint, context: KuluPayContext | Promise<KuluPayContext>) => {
        const wrapped = async (input?: any) => {
            const kuluPayContext = await context;
            const isContext = input && (input.request || input.headers || input.body || input.query);
            const internalContext = isContext ? input : {
                body: input,
                query: input,
                params: input,
                ...input
            };
            return kuluPayContextStore.run(kuluPayContext, () => (endpoint as any)({
                ...internalContext,
                context: {
                    ...kuluPayContext,
                    ...internalContext.context,
                },
            }));
        };
        (wrapped as any).path = endpoint.path;
        (wrapped as any).options = endpoint.options;
        return wrapped;
    };

	for (const [key, endpoint] of Object.entries(endpoints)) {
		api[key] = wrapEndpoint(endpoint, ctx);
	}

    // Add plugin endpoints
    const addPluginEndpoints = async () => {
        const kuluPayContext = await ctx;
        for (const plugin of kuluPayContext.providers.values()) {
            const pluginWithEndpoints = plugin as any;
            if (pluginWithEndpoints.endpoints) {
                for (const [key, endpoint] of Object.entries(pluginWithEndpoints.endpoints)) {
                    api[key] = wrapEndpoint(endpoint as any, ctx);
                }
            }
            if (pluginWithEndpoints.actions) {
                api[plugin.id] = pluginWithEndpoints.actions;
            }
        }
    };

    addPluginEndpoints();

	return api as E;
}

export * from "./middleware";
 