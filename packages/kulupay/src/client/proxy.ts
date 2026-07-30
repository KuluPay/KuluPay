/**
 * Dynamic path proxy — maps property access to API paths.
 * Inspired by better-auth's createDynamicPathProxy.
 *
 * `client.createIntent({ amount: 2500 })` → POST /create-intent
 * `client.getIntent({ id: "x" })` → GET /get-intent?id=x
 * `client.listPayments({ status: "succeeded" })` → GET /list-payments?status=succeeded
 */

export interface PayFetchOptions {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    headers?: Record<string, string>;
    body?: any;
    query?: Record<string, any>;
    onSuccess?: (response: any) => void;
    onError?: (error: any) => void;
}

export type PayFetcher = (
    path: string,
    options: PayFetchOptions,
) => Promise<any>;

const toPathParam = (segment: string): string =>
    segment.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

function buildQueryString(query: Record<string, any>): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null) continue;
        if (Array.isArray(value)) {
            params.append(key, value.join(","));
        } else {
            params.append(key, String(value));
        }
    }
    const str = params.toString();
    return str ? `?${str}` : "";
}

export function createDynamicPathProxy(
    fetcher: PayFetcher,
    knownMethods: Record<string, "GET" | "POST"> = {},
    pluginActions: Record<string, any> = {},
): any {
    const target: Record<string, any> = {};

    function createProxy(path: string[] = []): any {
        return new Proxy(function () {}, {
            get(_, prop) {
                if (typeof prop !== "string") return undefined;
                if (prop === "then" || prop === "catch" || prop === "finally") {
                    return undefined;
                }

                // Check own properties first (usePay, confirmPayment, $intent, etc.)
                if (prop in target) {
                    return target[prop];
                }

                const fullPath = [...path, prop];

                // Check plugin actions
                let current: any = pluginActions;
                for (const segment of fullPath) {
                    if (current && typeof current === "object" && segment in current) {
                        current = current[segment];
                    } else {
                        current = undefined;
                        break;
                    }
                }
                if (typeof current === "function") return current;
                if (current && typeof current === "object" && !Array.isArray(current)) {
                    return current;
                }

                return createProxy(fullPath);
            },
            set(_, prop, value) {
                if (typeof prop === "string") {
                    target[prop] = value;
                }
                return true;
            },
            apply: async (_, __, args) => {
                const routePath =
                    "/" +
                    path.map(toPathParam).join("/");

                const arg = (args[0] || {}) as {
                    query?: Record<string, any>;
                    body?: any;
                    fetchOptions?: PayFetchOptions;
                };

                const fetchOptions = (args[1] || {}) as PayFetchOptions;

                // Determine method
                let method: "GET" | "POST" = knownMethods[routePath] || "GET";
                if (!knownMethods[routePath]) {
                    method = (fetchOptions.method as "GET" | "POST") || (arg.body || Object.keys(arg).length > 0 ? "POST" : "GET");
                }

                const { query, body, fetchOptions: argFetch, ...rest } = arg;
                const mergedOptions: PayFetchOptions = {
                    ...fetchOptions,
                    ...argFetch,
                    method,
                    query: query || (method === "GET" ? rest : undefined) || fetchOptions.query,
                    body: method === "GET" ? undefined : { ...rest, ...body, ...(fetchOptions.body || {}) },
                };

                const queryString = buildQueryString(mergedOptions.query || {});
                const fullPath = `${routePath}${queryString}`;

                try {
                    const data = await fetcher(fullPath, mergedOptions);
                    return { data, error: null };
                } catch (e: any) {
                    return { data: null, error: e };
                }
            },
        });
    }
    const proxy = createProxy();

    // Store own properties on the proxy target so Object.assign works
    return new Proxy(proxy, {
        get(_, prop) {
            if (typeof prop === "string" && prop in target) {
                return target[prop];
            }
            return (proxy as any)[prop];
        },
        set(_, prop, value) {
            if (typeof prop === "string") {
                target[prop] = value;
            }
            return true;
        },
    });
}
