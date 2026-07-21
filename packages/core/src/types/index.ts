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
 * - PostgreSQL (via `@farming-labs/orm-sql` + `pg`)
 * - Neon (via `@farming-labs/orm-sql` + `@neondatabase/serverless`)
 * - MySQL (via `@farming-labs/orm-sql` + `mysql2`)
 * - SQLite (via `@farming-labs/orm-sql` + `better-sqlite3`)
 * - Prisma (via `@farming-labs/orm-prisma`)
 * - Drizzle (via `@farming-labs/orm-drizzle`)
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
 * import { createPgPoolDriver } from "@farming-labs/orm-sql";
 * import { Pool } from "pg";
 * const pay = kuluPay({
 *   database: createPgPoolDriver(new Pool({ connectionString: process.env.DATABASE_URL })),
 *   providers: [stripe({ apiKey: "sk_..." })],
 * });
 *
 * // Neon (serverless, HTTP-based)
 * import { createPgPoolDriver } from "@farming-labs/orm-sql";
 * import { Pool } from "@neondatabase/serverless";
 * const pay = kuluPay({
 *   database: createPgPoolDriver(new Pool({ connectionString: process.env.DATABASE_URL })),
 *   providers: [stripe({ apiKey: "sk_..." })],
 * });
 *
 * // Prisma
 * import { createPrismaDriver } from "@farming-labs/orm-prisma";
 * import { PrismaClient } from "@prisma/client";
 * const pay = kuluPay({
 *   database: createPrismaDriver({ client: new PrismaClient() }),
 *   providers: [stripe({ apiKey: "sk_..." })],
 * });
 *
 * // Drizzle
 * import { createDrizzleDriver } from "@farming-labs/orm-drizzle";
 * import { drizzle } from "drizzle-orm/node-postgres";
 * const pay = kuluPay({
 *   database: createDrizzleDriver({ db: drizzle(pool), dialect: "postgres" }),
 *   providers: [stripe({ apiKey: "sk_..." })],
 * });
 *
 * // Memory (for testing)
 * import { createMemoryDriver } from "@farming-labs/orm";
 * const pay = kuluPay({
 *   database: createMemoryDriver(),
 *   providers: [stripe({ apiKey: "sk_..." })],
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
    providers?: PaymentProvider[];
    baseURL?: BaseURLConfig;
    basePath?: string;
    debug?: boolean;
    plugins?: any[];
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
     *         const product = await myDB.products.findById(data.metadata.productId);
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
    payment?: KuluPayDBOptions<"id" | "userId" | "amount" | "currency" | "status" | "providerId" | "metadata" | "createdAt" | "updatedAt" | "type" | "description" | "customerId" | "providerPaymentId" | "clientSecret">;
    customer?: KuluPayDBOptions<"id" | "userId" | "providerId" | "providerCustomerId" | "createdAt" | "updatedAt">;
    subscription?: KuluPayDBOptions<"id" | "userId" | "planId" | "status" | "providerSubscriptionId" | "currentPeriodEnd" | "cancelAtPeriodEnd" | "createdAt" | "updatedAt">;
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
    };
    plugins: any[];
    trustedOrigins: string[];
    session?: KuluPaySession | null;
}

/**
 * Defines a payment provider integration (e.g. Stripe, PayPal, Chapa).
 * Implement this interface to add a new payment provider.
 */
export interface PaymentProvider {
    id: string;
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
export type PaymentStatus = "pending" | "processing" | "succeeded" | "failed" | "canceled";

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
    id?: string;
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
