import { atom, type WritableAtom } from "nanostores";
import { createDynamicPathProxy, type PayFetcher, type PayFetchOptions } from "./proxy";
import { KuluPayClientError } from "./error";

export interface PayClientPlugin {
    id: string;
    getActions?: (fetcher: PayFetcher, options: PayClientOptions) => Record<string, any>;
    getAtoms?: (fetcher: PayFetcher) => Record<string, WritableAtom<any>>;
}

export interface PayClientOptions {
    baseURL: string;
    basePath?: string;
    headers?: Record<string, string>;
    plugins?: PayClientPlugin[];
    fetchOptions?: PayFetchOptions;
}

export interface PayAtom {
    data: any;
    error: KuluPayClientError | null;
    isPending: boolean;
}

export const ERROR_CODES = {
    UNKNOWN: "UNKNOWN",
    INTERNAL_ERROR: "INTERNAL_ERROR",
    NO_INTENT: "NO_INTENT",
    NO_PROVIDER: "NO_PROVIDER",
    NOT_SUPPORTED: "NOT_SUPPORTED",
    CONFIRM_FAILED: "CONFIRM_FAILED",
    VERIFY_FAILED: "VERIFY_FAILED",
} as const;

const DEFAULT_KNOWN_METHODS: Record<string, "GET" | "POST"> = {
    "/create-intent": "POST",
    "/get-intent": "GET",
    "/list-payments": "GET",
    "/create-customer": "POST",
    "/get-customer": "GET",
    "/create-subscription": "POST",
    "/get-subscription": "GET",
    "/cancel-subscription": "POST",
    "/list-subscriptions": "GET",
    "/refund": "POST",
    "/capture": "POST",
    "/analytics": "GET",
    "/confirm-payment": "POST",
    "/verify-payment": "GET",
};

function createFetcher(options: PayClientOptions): PayFetcher {
    const baseURL = options.baseURL.replace(/\/$/, "");
    const basePath = (options.basePath || "/api/pay").replace(/\/$/, "");
    const baseHeaders = options.headers || {};

    return async (path: string, fetchOptions: PayFetchOptions) => {
        const method = fetchOptions.method || "GET";
        const url = `${baseURL}${basePath}${path}`;

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            ...baseHeaders,
            ...(fetchOptions.headers || {}),
        };

        const res = await fetch(url, {
            method,
            headers,
            body: fetchOptions.body ? JSON.stringify(fetchOptions.body) : undefined,
            credentials: "include",
        });

        const text = await res.text();
        let json: any;
        try {
            json = text ? JSON.parse(text) : {};
        } catch {
            json = { raw: text };
        }

        if (!res.ok) {
            const error = json?.error || json;
            const clientError = new KuluPayClientError(
                error?.code || "INTERNAL_ERROR",
                error?.message || `Request failed with status ${res.status}`,
                res.status,
                error?.data,
            );
            if (error?.developerMessage) clientError.developerMessage = error.developerMessage;
            if (error?.hint) clientError.hint = error.hint;
            fetchOptions.onError?.(clientError);
            throw clientError;
        }

        fetchOptions.onSuccess?.(json);
        return json;
    };
}

export function createPayClient(options: PayClientOptions) {
    const fetcher = createFetcher(options);
    const knownMethods = { ...DEFAULT_KNOWN_METHODS };

    // Core atoms — like better-auth's session atom
    const $paySignal = atom(false);
    const $intent = atom<PayAtom>({
        data: null,
        error: null,
        isPending: false,
    });

    // Collect plugin atoms and actions
    const pluginActions: Record<string, any> = {};
    const pluginAtoms: Record<string, WritableAtom<any>> = {
        $paySignal,
        intent: $intent,
    };

    for (const plugin of options.plugins || []) {
        if (plugin.getAtoms) {
            Object.assign(pluginAtoms, plugin.getAtoms(fetcher));
        }
        if (plugin.getActions) {
            Object.assign(pluginActions, plugin.getActions(fetcher, options));
        }
    }

    const proxy = createDynamicPathProxy(fetcher, knownMethods, pluginActions);

    return Object.assign(proxy, {
        $fetch: fetcher,
        $options: options,
        baseURL: options.baseURL,
        $atoms: pluginAtoms,
        $paySignal,
        $intent,
        $ERROR_CODES: ERROR_CODES,
    });
}

export type PayClient = ReturnType<typeof createPayClient>;
export { KuluPayClientError };


