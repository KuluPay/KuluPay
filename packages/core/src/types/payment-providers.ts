import { KuluPayContext, DatabaseHook } from "./core";
import type { ChainConfig, TokenConfig, ChainFamily } from "../payment-providers/onchain/types";

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
 * This is safe to send to the client — contains no recipient addresses or secrets.
 * Used by the internal /config endpoint to configure AppKit networks.
 */
export interface ProviderChainConfig {
    family: ChainFamily;
    chainId: number;
    name: string;
    rpcUrl: string;
    explorerUrl?: string;
    isTestnet?: boolean;
    tokens: Record<string, TokenConfig>;
}

export interface PaymentProvider {
    id: string;
    /** How this provider handles checkout. Defaults to "none" if not specified. */
    checkout?: CheckoutFlow;
    /**
     * Public chain configuration for onchain providers.
     * Present when the provider handles onchain payments (EVM, Tron).
     * Used by the /config endpoint to expose chain info to the client.
     */
    chainConfig?: ProviderChainConfig;
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
    /** Token to use for this payment (e.g. "USDC", "USDT", "native"). */
    token?: string;
    metadata?: Record<string, any>;
}

export class ProviderError extends Error {
    constructor(message: string, public provider: string) {
        super(message);
        this.name = "ProviderError";
    }
}
