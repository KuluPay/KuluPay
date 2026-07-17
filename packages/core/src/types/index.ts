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
 * @example
 * ```ts
 * // Connection string (auto-detects, requires @farming-labs/orm-sql + pg)
 * const pay = kuluPay({
 *   database: process.env.DATABASE_URL,
 *   providers: [stripe({ apiKey: "sk_..." })],
 * });
 *
 * // pg Pool instance (requires @farming-labs/orm-sql)
 * const pay = kuluPay({
 *   database: new Pool({ connectionString: process.env.DATABASE_URL }),
 *   providers: [stripe({ apiKey: "sk_..." })],
 * });
 *
 * // Farming ORM driver (full control)
 * const pay = kuluPay({
 *   database: createPgPoolDriver(new Pool({ connectionString: process.env.DATABASE_URL })),
 *   providers: [stripe({ apiKey: "sk_..." })],
 * });
 * ```
 */
export interface KuluPayOptions {
    /**
     * Database configuration. Accepts:
     * - A Postgres/MySQL connection string (e.g. `"postgresql://user:pass@host/db"`)
     * - A `pg.Pool` instance
     * - A Farming ORM driver (e.g. from `createMemoryDriver()` or `createPgPoolDriver()`)
     *
     * For connection strings or pg Pool, install `@farming-labs/orm-sql` and `pg`.
     */
    database: any;
    providers?: PaymentProvider[];
    baseURL?: BaseURLConfig;
    basePath?: string;
    debug?: boolean;
    plugins?: any[];
    payment?: KuluPayDBOptions<"id" | "userId" | "amount" | "currency" | "status" | "providerId" | "metadata" | "createdAt" | "updatedAt">;
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
