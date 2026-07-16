import { KuluPayContext, DatabaseHook } from "./core";

export interface PaymentProvider {
    id: string;
    createIntent: (data: CreateIntentData) => Promise<PaymentIntent>;
    getIntent: (id: string) => Promise<PaymentIntent>;
    cancelIntent: (id: string) => Promise<PaymentIntent>;
    hooks?: {
        payment?: DatabaseHook<any>;
        customer?: DatabaseHook<any>;
        subscription?: DatabaseHook<any>;
    };
}

export interface PaymentIntent {
    id: string;
    amount: number;
    currency: string;
    status: "pending" | "processing" | "succeeded" | "failed" | "canceled";
    clientSecret?: string;
    metadata?: Record<string, any>;
}

export interface CreateIntentData {
    amount: number;
    currency: string;
    userId: string;
    providerId: string;
    metadata?: Record<string, any>;
}

export class ProviderError extends Error {
    constructor(message: string, public provider: string) {
        super(message);
        this.name = "ProviderError";
    }
}
