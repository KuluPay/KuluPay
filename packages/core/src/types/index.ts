export type BaseURLConfig = string | DynamicBaseURLConfig;

export interface DynamicBaseURLConfig {
    allowedHosts: string[];
    fallback?: string;
    protocol?: "http" | "https" | "auto";
}

export interface KuluPayOptions {
    database: any; // Farming ORM driver
    providers?: PaymentProvider[];
    baseURL?: BaseURLConfig;
    basePath?: string;
    debug?: boolean;
    plugins?: any[];
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
    orm: KuluPayORM;
    logger: {
        debug: (message: string, ...args: any[]) => void;
        error: (message: string, ...args: any[]) => void;
    };
    plugins: any[];
    trustedOrigins: string[];
}

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

export type PaymentStatus = "pending" | "processing" | "succeeded" | "failed" | "canceled";

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

export interface CreateCustomerData {
    userId: string;
    providerId: string;
    email?: string;
    name?: string;
    metadata?: Record<string, any>;
}

export interface CreateSubscriptionData {
    userId: string;
    providerId: string;
    planId: string;
    customerId?: string;
    paymentMethodId?: string;
    metadata?: Record<string, any>;
}

export interface WebhookEvent {
    type: string;
    providerId: string;
    externalId: string;
    data: Record<string, any>;
    timestamp: Date;
}

export type DatabaseHook<T> = {
    before?: (data: T, ctx: KuluPayContext) => Promise<T | void>;
    after?: (data: T, ctx: KuluPayContext) => Promise<void>;
};

export interface Customer {
    id: string;
    userId: string;
    providerId: string;
    providerCustomerId: string;
    createdAt: Date;
    updatedAt: Date;
}

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

export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled" | "unpaid" | "incomplete" | "incomplete_expired" | "paused";

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
