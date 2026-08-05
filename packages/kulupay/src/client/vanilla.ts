import { atom, type WritableAtom } from "nanostores";
import { createFetch } from "@better-fetch/fetch";
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
    /**
     * Reown WalletConnect project ID.
     * Public — like a Stripe publishable key. Get one at https://dashboard.reown.com.
     * Required when onchain providers (EVM, Tron) are configured.
     * Ignored when only offchain providers (Stripe, Chapa, PayPal) are used.
     */
    walletConnectProjectId?: string;
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

function createFetcher(options: PayClientOptions): PayFetcher {
    const baseURL = options.baseURL.replace(/\/$/, "");
    const basePath = (options.basePath || "/api/pay").replace(/\/$/, "");

    const $fetch = createFetch({
        baseURL: `${baseURL}${basePath}`,
        headers: {
            "Content-Type": "application/json",
            ...options.headers,
        },
        credentials: "include",
    });

    return async (path: string, fetchOptions: PayFetchOptions) => {
        const method = (fetchOptions.method || "GET") as any;

        const { data, error } = await $fetch(path, {
            method,
            body: fetchOptions.body,
            headers: fetchOptions.headers,
            onSuccess: (ctx: any) => {
                fetchOptions.onSuccess?.(ctx.data);
            },
            onError: (ctx: any) => {
                const err = ctx.error;
                const clientError = new KuluPayClientError(
                    err?.code || "INTERNAL_ERROR",
                    err?.message || `Request failed`,
                    err?.status || 500,
                    err?.data,
                );
                if (err?.developerMessage) clientError.developerMessage = err.developerMessage;
                if (err?.hint) clientError.hint = err.hint;
                fetchOptions.onError?.(clientError);
            },
        });

        if (error) {
            const err = error as any;
            const clientError = new KuluPayClientError(
                err?.code || "INTERNAL_ERROR",
                err?.message || `Request failed`,
                err?.status || 500,
                err?.data,
            );
            if (err?.developerMessage) clientError.developerMessage = err.developerMessage;
            if (err?.hint) clientError.hint = err.hint;
            throw clientError;
        }

        return data;
    };
}

export function createPayClient(options: PayClientOptions) {
    const fetcher = createFetcher(options);

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

    const proxy = createDynamicPathProxy(fetcher, pluginActions);

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


