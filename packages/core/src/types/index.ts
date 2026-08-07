import type { PaymentFieldKeys, CustomerFieldKeys, SubscriptionFieldKeys } from "../db/schema";
import type { OnchainConfig } from "../payment-providers/onchain/config";

/**
 * The base URL configuration for the KuluPay server.
 * Can be a static string or a dynamic configuration for multi-tenant setups.
 */
export type BaseURLConfig = string | DynamicBaseURLConfig;

/**
 * Configuration for dynamic base URL resolution (e.g. wildcard subdomains).
 */
export interface DynamicBaseURLConfig {
    allowedHosts: string[];
    fallback?: string;
    protocol?: "http" | "https" | "auto";
}

/**
 * Supported field types for additional custom fields.
 */
export type FieldType = "string" | "number" | "boolean" | "datetime" | "json";

/**
 * Defines a custom additional field to be merged into a KuluPay table schema.
 * @example
 * ```ts
 * kuluPay({
 *   payment: {
 *     additionalFields: {
 *       description: { type: "string", required: false }
 *     }
 *   }
 * })
 * ```
 */
export interface AdditionalField {
    type: FieldType;
    required?: boolean;
    unique?: boolean;
    defaultValue?: any;
    input?: boolean;
}

/**
 * Database options for a KuluPay table.
 * Allows renaming the table, renaming individual columns, and adding custom fields.
 * @template Keys - The known field names of the table.
 */
export type KuluPayDBOptions<Keys extends string = string> = {
    modelName?: string;
    fields?: Partial<Record<Exclude<Keys, "id">, string>>;
    additionalFields?: Record<string, AdditionalField>;
};

/**
 * The main configuration options for the KuluPay SDK.
 *
 * KuluPay uses the Farming ORM for database access, which means it supports
 * any database that Farming ORM has a driver for:
 * - PostgreSQL (via `@kulupay/adapter-sql` + `pg`)
 * - Neon (via `@kulupay/adapter-sql` + `@neondatabase/serverless`)
 * - MySQL (via `@kulupay/adapter-sql` + `mysql2`)
 * - SQLite (via `@kulupay/adapter-sql` + `better-sqlite3`)
 * - Prisma (via `@kulupay/adapter-prisma`)
 * - Drizzle (via `@kulupay/adapter-drizzle`)
 * - EdgeDB / Gel (via `@farming-labs/orm-edgedb`)
 * - Cloudflare D1 (via `@farming-labs/orm-d1`)
 * - MongoDB / Mongoose (via `@farming-labs/orm-mongodb`)
 * - Supabase (via `@farming-labs/orm-supabase`)
 * - Redis / Upstash (via `@farming-labs/orm-redis`)
 * - And more...
 *
 * The user is responsible for creating the driver and passing it to the `database` option.
 *
 * @example
 * ```ts
 * // PostgreSQL
 * import { pg } from "@kulupay/adapter-sql";
 * import { Pool } from "pg";
 * const pay = kuluPay({
 *   database: pg(new Pool({ connectionString: process.env.DATABASE_URL })),
 *   providers: {
 *     ethereum: {
 *       recipientAddress: process.env.NEXT_PUBLIC_EVM_RECIPIENT_ADDRESS as `0x${string}`,
 *       tokens: ["USDC"],
 *     },
 *   },
 * });
 *
 * // Drizzle
 * import { drizzleAdapter } from "@kulupay/adapter-drizzle";
 * import { drizzle } from "drizzle-orm/node-postgres";
 * const pay = kuluPay({
 *   database: drizzleAdapter(drizzle(pool), { provider: "pg" }),
 *   providers: {
 *     base: {
 *       recipientAddress: process.env.NEXT_PUBLIC_EVM_RECIPIENT_ADDRESS as `0x${string}`,
 *       tokens: ["USDC"],
 *     },
 *     tron: {
 *       recipientAddress: process.env.NEXT_PUBLIC_TRON_RECIPIENT_ADDRESS!,
 *       tokens: ["USDT"],
 *     },
 *   },
 * });
 *
 * // Memory (for testing)
 * import { createMemoryDriver } from "@farming-labs/orm";
 * const pay = kuluPay({
 *   database: createMemoryDriver(),
 *   providers: {
 *     base: {
 *       recipientAddress: "0x0000000000000000000000000000000000000000",
 *       tokens: ["USDC"],
 *     },
 *   },
 * });
 * ```
 */
export interface KuluPayOptions {
    /**
     * A Farming ORM driver instance. The user creates the driver using
     * the appropriate Farming ORM adapter package and passes it here.
     *
     * See the package README for examples with PostgreSQL, Neon, Prisma,
     * Drizzle, MongoDB, and other supported databases.
     */
    database: any;
    providers?: OnchainConfig;
    /**
     * Base URL for the KuluPay server. This is typically the root URL where
     * your application server is hosted (e.g. `https://myapp.com`).
     *
     * Used on the server for:
     * - Trusted origins / CORS validation
     * - Webhook signature verification
     * - Redirect URLs for redirect-based providers (Stripe, Chapa, PayPal)
     *
     * The client (`createPayClient`) also needs to know this URL to send
     * HTTP requests to the server. If the client and server share the same
     * domain, the client can infer it automatically. If they're on different
     * domains, pass it explicitly to `createPayClient({ baseURL })`.
     *
     * Can be a static string or a dynamic config object for multi-tenant
     * setups (wildcard subdomains, preview deployments, etc.).
     *
     * If not set, it will be inferred from the incoming request.
     * Relying on request inference is not recommended for production.
     *
     * @example
     * ```ts
     * kuluPay({
     *   baseURL: "https://myapp.com",
     *   // or dynamic:
     *   baseURL: {
     *     allowedHosts: ["myapp.com", "*.vercel.app"],
     *     protocol: "https",
     *     fallback: "https://myapp.com",
     *   },
     * })
     * ```
     */
    baseURL?: BaseURLConfig;
    /**
     * Base path where KuluPay routes are mounted. Defaults to `/api/pay`.
     *
     * The client must use the same base path. If you change this on the
     * server, also pass it to `createPayClient({ basePath })`.
     */
    basePath?: string;
    debug?: boolean;
    /**
     * Reown (WalletConnect) project ID for AppKit wallet connections.
     *
     * Get one free at https://dashboard.reown.com
     *
     * Required when onchain providers (ethereum, polygon, base, arbitrum,
     * tron, etc.) are configured — AppKit handles all wallet connections
     * (600+ wallets, mobile QR codes, network switching, pre-built modal).
     *
     * Ignored when no onchain providers are configured (Stripe/Chapa/PayPal
     * only setups).
     *
     * The client discovers this automatically via the internal `/config`
     * endpoint — no separate client-side configuration needed.
     *
     * @example
     * ```ts
     * kuluPay({
     *   providers: {
     *     ethereum: { recipientAddress: "0x...", tokens: ["USDC"] },
     *     tron: { recipientAddress: "T...", tokens: ["USDT"] },
     *   },
     *   walletConnectProjectId: "YOUR_PROJECT_ID",
     * })
     * ```
     */
    walletConnectProjectId?: string;
    plugins?: KuluPayPlugin[];
    /**
     * Authentication configuration. KuluPay is auth-agnostic — you plug in
     * your own session resolver (e.g. better-auth, NextAuth, custom JWT).
     * When configured, user-facing routes require a valid session and
     * `userId` is taken from the session, not the request body.
     */
    auth?: {
        getSession?: (request: Request) => Promise<KuluPaySession | null>;
        authorize?: (action: string, ctx: KuluPayContext, session: KuluPaySession) => Promise<boolean>;
    };
    /**
     * Trusted origins for CSRF/origin validation. Can be a static list or
     * a function that returns origins dynamically (e.g. from a database).
     * The baseURL is always trusted automatically.
     */
    trustedOrigins?: string[] | ((request: Request) => Promise<string[]>);
    /**
     * Pricing configuration. When `resolvePrice` is provided, KuluPay calls it
     * BEFORE creating a payment intent. The returned amount/currency overrides
     * whatever the client sent — this prevents users from manipulating prices.
     *
     * Example:
     * ```ts
     * pricing: {
     *     resolvePrice: async (data, ctx) => {
     *         const product = await myDB.products.findById(data.productId);
     *         return { amount: product.price, currency: product.currency };
     *     }
     * }
     * ```
     *
     * If not configured, KuluPay uses the client-sent amount (for dev/testing).
     */
    pricing?: {
        resolvePrice?: (
            data: CreateIntentData,
            ctx: KuluPayContext,
        ) => Promise<{ amount: number; currency: string }>;
    };
    /**
     * Expand configuration. Lets you attach related data (users, products)
     * from YOUR database to KuluPay's payment/subscription responses.
     *
     * KuluPay calls these resolvers when `?expand=user,product` is passed
     * on list-payments or analytics endpoints. KuluPay doesn't know your
     * schema — you provide the lookup functions.
     *
     * Example:
     * ```ts
     * expand: {
     *     user: async (userIds, ctx) => {
     *         const users = await myDB.users.findMany({ where: { id: { in: userIds } } });
     *         return new Map(users.map(u => [u.id, u]));
     *     },
     *     product: async (productIds, ctx) => {
     *         const products = await myDB.products.findMany({ where: { id: { in: productIds } } });
     *         return new Map(products.map(p => [p.id, p]));
     *     }
     * }
     * ```
     */
    expand?: {
        user?: (userIds: string[], ctx: KuluPayContext) => Promise<Map<string, any>>;
        product?: (productIds: string[], ctx: KuluPayContext) => Promise<Map<string, any>>;
    };
    /**
     * Database relations. If your user/product tables are in the SAME database
     * as KuluPay, you can define relations here for native ORM joins (faster
     * than expand). This is optional — use expand if your tables are in a
     * different database or ORM.
     *
     * Example (better-auth users in same DB):
     * ```ts
     * relations: {
     *     user: { model: "user", foreignKey: "id" },
     * }
     * ```
     *
     * When relations are defined, list-payments with ?expand=user will use
     * ORM-level includes instead of calling expand.user().
     */
    relations?: {
        user?: { model: string; foreignKey: string };
        product?: { model: string; foreignKey: string };
    };
    payment?: KuluPayDBOptions<PaymentFieldKeys>;
    customer?: KuluPayDBOptions<CustomerFieldKeys>;
    subscription?: KuluPayDBOptions<SubscriptionFieldKeys>;
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

/**
 * A middleware definition contributed by a plugin.
 * Mirrors better-auth's plugin middleware pattern.
 */
export interface KuluPayMiddlewareDefinition {
    /** Path pattern this middleware applies to (e.g. "/**" for all routes) */
    path: string;
    /** The middleware function */
    middleware: any;
}

/**
 * Rate limiting configuration.
 * Mirrors better-auth's rate limit pattern.
 */
export interface KuluPayRateLimitConfig {
    /** Window in seconds */
    window: number;
    /** Max requests per window */
    max: number;
    /** Custom key generator (defaults to IP-based) */
    keyGenerator?: (request: Request) => string | Promise<string>;
}

/**
 * Hook context passed to before/after hooks.
 * Mirrors better-auth's HookEndpointContext.
 */
export type HookEndpointContext = {
    path?: string;
    method?: string;
    headers?: Headers;
    body?: any;
    query?: any;
    params?: any;
    context: KuluPayContext & {
        returned?: unknown;
        responseHeaders?: Headers | undefined;
    };
};

/**
 * A KuluPay plugin — mirrors BetterAuthPlugin.
 *
 * Plugins can:
 * - Add endpoints to the API surface
 * - Contribute middlewares to the router middleware chain
 * - Register before/after hooks that run around endpoint handlers
 * - Hook into onRequest/onResponse lifecycle
 * - Extend the schema with additional fields
 * - Configure rate limiting
 * - Run an init function on startup that can modify context/options
 * - Export error codes and inferred types
 *
 * @example
 * ```ts
 * const myPlugin: KuluPayPlugin = {
 *   id: "my-plugin",
 *   endpoints: {
 *     getCustomData: createKuluPayEndpoint("/get-custom-data", { method: "GET" }, async (ctx) => { ... }),
 *   },
 *   middlewares: [
 *     { path: "/**", middleware: myAuthMiddleware },
 *   ],
 *   hooks: {
 *     before: [
 *       { matcher: (ctx) => ctx.path === "/create-intent", handler: async (ctx) => { ... } },
 *     ],
 *     after: [
 *       { matcher: (ctx) => ctx.path === "/create-intent", handler: async (ctx) => { ... } },
 *     ],
 *   },
 *   onRequest: async (req, ctx) => { ... },
 *   onResponse: async (res, ctx) => { ... },
 *   init: async (ctx) => { console.log("Plugin initialized"); },
 * };
 * ```
 */
export interface KuluPayPlugin {
    /** Unique plugin ID */
    id: string;
    /** Endpoints to merge into the API surface */
    endpoints?: Record<string, any>;
    /** Middlewares to add to the router middleware chain */
    middlewares?: KuluPayMiddlewareDefinition[];
    /** Before/after hooks that run around endpoint handlers */
    hooks?: {
        before?: {
            matcher: (context: HookEndpointContext) => boolean;
            handler: (context: HookEndpointContext) => Promise<unknown>;
        }[];
        after?: {
            matcher: (context: HookEndpointContext) => boolean;
            handler: (context: HookEndpointContext) => Promise<unknown>;
        }[];
    };
    /** Called on every request before routing — can short-circuit or modify request */
    onRequest?: (
        request: Request,
        ctx: KuluPayContext,
    ) => Promise<
        | { response: Response }
        | { request: Request }
        | void
    >;
    /** Called on every response after routing — can modify response */
    onResponse?: (
        response: Response,
        ctx: KuluPayContext,
    ) => Promise<{ response: Response } | void>;
    /** Rate limiting configuration */
    rateLimit?: KuluPayRateLimitConfig;
    /** Schema extension for database tables */
    schema?: Record<string, any>;
    /** Plugin-specific options */
    options?: Record<string, any>;
    /** Called once during initialization. Can return context/options modifications */
    init?: (
        ctx: KuluPayContext,
    ) => Promise<
        | {
            context?: Partial<Omit<KuluPayContext, "options">> & Record<string, unknown>;
            options?: Partial<KuluPayOptions>;
        }
        | void
    >;
    /** Error codes exported by this plugin */
    $ERROR_CODES?: Record<string, { code: string; message: string }>;
    /** Types to be inferred by consumers */
    $Infer?: Record<string, any>;
}

/**
 * Internal runtime context for KuluPay, created during initialization.
 * Not intended to be constructed directly by users.
 */
export interface KuluPayContext {
    options: KuluPayOptions;
    providers: Map<string, PaymentProvider>;
    baseURL: string;
    orm: KuluPayORM;
    logger: {
        debug: (message: string, ...args: any[]) => void;
        error: (message: string, ...args: any[]) => void;
        warn: (message: string, ...args: any[]) => void;
    };
    plugins: KuluPayPlugin[];
    trustedOrigins: string[];
    session?: KuluPaySession | null;
    /** Get a plugin by ID, or null if not installed */
    getPlugin: (id: string) => KuluPayPlugin | null;
    /** Check if a plugin is installed */
    hasPlugin: (id: string) => boolean;
}

/**
 * The checkout flow a provider uses. Declared by the provider developer
 * when implementing the provider — not guessed by the checkout UI.
 *
 * - "self-hosted": The checkout page handles wallet interaction (e.g. EVM, Tron)
 * - "redirect":    The provider hosts its own checkout page (e.g. Stripe Checkout, Chapa, PayPal)
 * - "embedded":    The provider's SDK is embedded in your page (e.g. Stripe Elements)
 * - "none":        No checkout UI needed (server-only, webhooks-only)
 */
export type CheckoutFlow = "self-hosted" | "redirect" | "embedded" | "none";

/**
 * Public chain metadata exposed by onchain providers.
 * Safe to send to the client — no recipient addresses or secrets.
 * Used by the /config endpoint to configure AppKit networks.
 */
export interface ProviderChainConfig {
    family: "evm" | "tron";
    chainId: number;
    name: string;
    rpcUrl: string;
    explorerUrl?: string;
    isTestnet?: boolean;
    tokens: Record<string, { symbol: string; decimals: number; contractAddress?: string }>;
}

/**
 * Defines a payment provider integration (e.g. Stripe, PayPal, Chapa).
 * Implement this interface to add a new payment provider.
 */
export interface PaymentProvider {
    id: string;
    /** How this provider handles checkout. Defaults to "none" if not specified. */
    checkout?: CheckoutFlow;
    /**
     * Public chain configuration for onchain providers (EVM, Tron).
     * Used by the /config endpoint to expose chain info to the client.
     */
    chainConfig?: ProviderChainConfig;
    createIntent: (data: CreateIntentData) => Promise<PaymentIntent>;
    getIntent: (id: string) => Promise<PaymentIntent>;
    cancelIntent: (id: string) => Promise<PaymentIntent>;
    refund?: (id: string, amount?: number) => Promise<PaymentIntent>;
    capture?: (id: string, amount?: number) => Promise<PaymentIntent>;
    listPayments?: (userId: string, filters?: PaymentFilters) => Promise<PaymentIntent[]>;
    createCustomer?: (data: CreateCustomerData) => Promise<Customer>;
    getCustomer?: (id: string) => Promise<Customer>;
    createSubscription?: (data: CreateSubscriptionData) => Promise<Subscription>;
    getSubscription?: (id: string) => Promise<Subscription>;
    cancelSubscription?: (id: string) => Promise<Subscription>;
    webhookHandler?: (request: Request, ctx: KuluPayContext) => Promise<WebhookEvent>;
    endpoints?: Record<string, any>;
    actions?: Record<string, any>;
    hooks?: {
        payment?: DatabaseHook<any>;
        customer?: DatabaseHook<any>;
        subscription?: DatabaseHook<any>;
    };
}

/**
 * The status of a payment intent.
 */
export type PaymentStatus = "pending" | "processing" | "pending_confirmation" | "succeeded" | "failed" | "canceled" | "expired";

/**
 * Represents a payment intent created by a provider.
 */
export interface PaymentIntent {
    id: string;
    amount: number;
    currency: string;
    status: PaymentStatus;
    clientSecret?: string;
    redirects?: {
        success: string;
        cancel: string;
    };
    metadata?: Record<string, any>;
    raw?: any;
    type?: PaymentType;
    description?: string;
    providerPaymentId?: string;
}

/**
 * Data required to create a payment intent.
 */
export interface CreateIntentData {
    amount: number;
    currency: string;
    userId: string;
    providerId: string;
    /** Token to use for this payment (e.g. "USDC", "USDT", "native"). Falls back to metadata.token or "native". */
    token?: string;
    id?: string;
    productId?: string;
    description?: string;
    customerId?: string;
    metadata?: Record<string, any>;
    type?: PaymentType;
}

/**
 * Data required to create a customer in a provider.
 */
export interface CreateCustomerData {
    userId: string;
    providerId: string;
    email?: string;
    name?: string;
    metadata?: Record<string, any>;
}

/**
 * Data required to create a subscription.
 */
export interface CreateSubscriptionData {
    userId: string;
    providerId: string;
    planId: string;
    customerId?: string;
    paymentMethodId?: string;
    metadata?: Record<string, any>;
}

/**
 * A normalized webhook event from a payment provider.
 */
export interface WebhookEvent {
    type: string;
    providerId: string;
    externalId: string;
    data: Record<string, any>;
    timestamp: Date;
}

/**
 * A hook that runs before or after a database operation.
 */
export type DatabaseHook<T> = {
    before?: (data: T, ctx: KuluPayContext) => Promise<T | void>;
    after?: (data: T, ctx: KuluPayContext) => Promise<void>;
};

/**
 * Represents a customer record.
 */
export interface Customer {
    id: string;
    userId: string;
    providerId: string;
    providerCustomerId: string;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Represents a subscription record.
 */
export interface Subscription {
    id: string;
    userId: string;
    planId: string;
    status: SubscriptionStatus;
    providerSubscriptionId: string;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * The status of a subscription.
 */
export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled" | "unpaid" | "incomplete" | "incomplete_expired" | "paused";

/**
 * The ORM interface used internally by KuluPay for database operations.
 * Generated from the schema via Farming ORM.
 */
/**
 * Represents a resolved user session from the auth system.
 * KuluPay uses this to identify who is making requests.
 */
export interface KuluPaySession {
    user: {
        id: string;
        email?: string;
        name?: string;
        [key: string]: any;
    };
    session?: {
        id: string;
        [key: string]: any;
    };
}

/**
 * The type of a payment — distinguishes one-time charges from subscription invoices.
 */
export type PaymentType = "one_time" | "subscription_initial" | "topup" | "refund";

/**
 * Filters for listing payments.
 */
export interface PaymentFilters {
    status?: PaymentStatus;
    providerId?: string;
    limit?: number;
    offset?: number;
    startDate?: Date;
    endDate?: Date;
}

/**
 * Query parameters for payment analytics.
 * Used by the analytics route to compute revenue, counts, and breakdowns.
 */
export interface AnalyticsQuery {
    startDate?: Date;
    endDate?: Date;
    providerId?: string;
    groupBy?: "day" | "week" | "month" | "provider" | "status" | "type";
}

/**
 * Aggregated payment analytics result.
 * KuluPay computes this from the payment table — no business logic,
 * just database aggregation.
 */
export interface PaymentAnalytics {
    totalRevenue: number;
    totalPayments: number;
    successfulPayments: number;
    failedPayments: number;
    pendingPayments: number;
    refundedAmount: number;
    averagePaymentAmount: number;
    byProvider: Array<{
        providerId: string;
        revenue: number;
        count: number;
    }>;
    byStatus: Array<{
        status: PaymentStatus;
        count: number;
        amount: number;
    }>;
    byType: Array<{
        type: string;
        count: number;
        amount: number;
    }>;
    byDate?: Array<{
        date: string;
        revenue: number;
        count: number;
    }>;
}

/**
 * Client-side payment provider interface.
 * This is the client-side equivalent of PaymentProvider.
 *
 * While PaymentProvider runs on the server (with API keys, SDK access),
 * PaymentClientProvider runs in the browser (with publishable keys, SDK client-side).
 *
 * The flow is:
 * 1. Client calls KuluPayClient.createIntent() → hits server API → server calls PaymentProvider.createIntent()
 * 2. Server returns PaymentIntent with clientSecret
 * 3. Client calls PaymentClientProvider.confirmPayment(clientSecret) → uses provider SDK to confirm
 *
 * Implement this to add client-side provider support (e.g. Stripe Elements, Chapa checkout).
 */
export interface PaymentClientProvider {
    id: string;
    /**
     * Confirm a payment using the provider's client SDK.
     * Called after createIntent returns a clientSecret.
     */
    confirmPayment: (clientSecret: string, options?: PaymentConfirmOptions) => Promise<PaymentIntent>;
    /**
     * Get the provider's SDK instance (e.g. Stripe.js object).
     * Useful for mounting Elements, creating payment requests, etc.
     */
    getSDK?: () => Promise<any>;
    /**
     * Create an Elements instance (Stripe-specific, but generic enough).
     * Other providers can return their equivalent UI container.
     */
    createElements?: (options?: any) => Promise<any>;
    /**
     * Create a payment method (e.g. card token) using the provider's SDK.
     */
    createPaymentMethod?: (data: any) => Promise<any>;
    /**
     * Verify a payment status by polling the provider's client SDK.
     */
    verifyPayment?: (clientSecret: string) => Promise<PaymentIntent>;
}

/**
 * Options for confirming a payment on the client side.
 */
export interface PaymentConfirmOptions {
    /**
     * For Stripe Elements: the Elements instance to use.
     * For other providers: the equivalent UI container.
     */
    elements?: any;
    /**
     * The URL to redirect to after payment is confirmed.
     */
    redirectUrl?: string;
    /**
     * Whether to redirect automatically ("if_required" | "always").
     * Defaults to "if_required".
     */
    redirect?: "if_required" | "always";
    /**
     * Additional provider-specific confirm params.
     */
    confirmParams?: Record<string, any>;
    /**
     * Payment method data (for non-Elements confirmation).
     */
    paymentMethodData?: any;
    /**
     * The intent ID — providers should return this as `id` to preserve it.
     * Without this, providers may return txHash as `id`, overwriting the intent ID.
     */
    intentId?: string;
}

export type KuluPayORM = {
    payment: {
        create: (args: { data: any }) => Promise<any>;
        findFirst: (args: { where: any }) => Promise<any>;
        update: (args: { where: any; data: any }) => Promise<any>;
        findMany: (args?: { where?: any }) => Promise<any[]>;
        delete: (args: { where: any }) => Promise<any>;
    };
    customer: {
        create: (args: { data: any }) => Promise<any>;
        findFirst: (args: { where: any }) => Promise<any>;
        update: (args: { where: any; data: any }) => Promise<any>;
        findMany: (args?: { where?: any }) => Promise<any[]>;
        delete: (args: { where: any }) => Promise<any>;
    };
    subscription: {
        create: (args: { data: any }) => Promise<any>;
        findFirst: (args: { where: any }) => Promise<any>;
        update: (args: { where: any; data: any }) => Promise<any>;
        findMany: (args?: { where?: any }) => Promise<any[]>;
        delete: (args: { where: any }) => Promise<any>;
    };
};
