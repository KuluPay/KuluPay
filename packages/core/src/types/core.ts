import { PaymentProvider } from "./payment-providers";
import type { KuluPaySession, CreateIntentData } from "./index";

export interface KuluPayOptions {
    database: any; // Farming ORM driver
    providers?: PaymentProvider[];
    baseURL?: string;
    basePath?: string;
    debug?: boolean;
    plugins?: any[];
    auth?: {
        getSession?: (request: Request) => Promise<KuluPaySession | null>;
        authorize?: (action: string, ctx: KuluPayContext, session: KuluPaySession) => Promise<boolean>;
    };
    trustedOrigins?: string[] | ((request: Request) => Promise<string[]>);
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
