import { PaymentProvider } from "./payment-providers";
import type { KuluPaySession, CreateIntentData } from "./index";

export interface KuluPayOptions {
    database: any; // Farming ORM driver
    providers?: PaymentProvider[];
    /**
     * Base URL for the KuluPay server (e.g. `https://myapp.com`).
     * Used for trusted origins, webhook verification, and redirect URLs.
     * The client also needs this to send HTTP requests — if same domain,
     * it can be inferred automatically. See `createPayClient` docs.
     */
    baseURL?: string;
    /**
     * Base path where KuluPay routes are mounted. Defaults to `/api/pay`.
     * The client must use the same base path.
     */
    basePath?: string;
    debug?: boolean;
    /**
     * Reown (WalletConnect) project ID for AppKit wallet connections.
     * Get one free at https://dashboard.reown.com
     *
     * Required when onchain providers are configured — AppKit handles
     * all wallet connections (600+ wallets, mobile QR, network switching).
     * Ignored when no onchain providers are configured.
     *
     * The client discovers this via the internal `/config` endpoint.
     */
    walletConnectProjectId?: string;
    plugins?: any[];
    auth?: {
        getSession?: (request: Request) => Promise<KuluPaySession | null>;
        authorize?: (action: string, ctx: KuluPayContext, session: KuluPaySession) => Promise<boolean>;
    };
    trustedOrigins?: string[] | ((request: Request) => Promise<string[]>);
    /**
     * URL or URL pattern for the checkout page. When set, the `createIntent`
     * response includes a `checkoutUrl` field with the intentId and clientSecret
     * already embedded — the client can simply redirect to it.
     *
     * Supports `{intentId}` and `{clientSecret}` placeholders.
     * Example: `"/checkout?intentId={intentId}&clientSecret={clientSecret}"`
     *
     * If not set, the client must build the URL manually from the response.
     */
    checkoutUrl?: string;
    pricing?: {
        resolvePrice?: (
            data: CreateIntentData,
            ctx: KuluPayContext,
        ) => Promise<{ amount: number; currency: string }>;
    };
    databaseHooks?: {
        payment?: {
            create?: DatabaseHook<any>;
            update?: DatabaseHook<any>;
        };
        customer?: {
            create?: DatabaseHook<any>;
            update?: DatabaseHook<any>;
        };
    };
}

export interface KuluPayContext {
    options: KuluPayOptions;
    providers: Map<string, PaymentProvider>;
    baseURL: string;
    orm: any; // Farming ORM instance
    logger: {
        debug: (message: string, ...args: any[]) => void;
        error: (message: string, ...args: any[]) => void;
    };
    plugins: any[];
    trustedOrigins: string[];
    session?: KuluPaySession | null;
}

export type DatabaseHook<T> = {
    before?: (data: T, ctx: KuluPayContext) => Promise<T | void>;
    after?: (data: T, ctx: KuluPayContext) => Promise<void>;
};
