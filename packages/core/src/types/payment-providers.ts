import { KuluPayContext, DatabaseHook } from "./core";

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

export interface PaymentProvider {
    id: string;
    /** How this provider handles checkout. Defaults to "none" if not specified. */
    checkout?: CheckoutFlow;
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
    status: "pending" | "processing" | "pending_confirmation" | "succeeded" | "failed" | "canceled" | "expired";
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
