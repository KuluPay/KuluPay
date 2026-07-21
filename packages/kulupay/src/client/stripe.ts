import type { CreateIntentData, PaymentIntent } from "@kulupay/core";
import { KuluPayError } from "./error";

export interface StripeClientOptions {
    publishableKey: string;
    baseURL?: string;
}

type StripeSDK = Awaited<ReturnType<typeof import('@stripe/stripe-js').loadStripe>>;

let stripeModulePromise: Promise<typeof import('@stripe/stripe-js')> | null = null;

const getStripeModule = async () => {
    if (!stripeModulePromise) {
        stripeModulePromise = import('@stripe/stripe-js').catch(() => {
            throw new KuluPayError(
                "stripe_sdk_missing",
                "@stripe/stripe-js not found. Install it with: npm install @stripe/stripe-js",
                500,
            );
        });
    }
    return stripeModulePromise;
};

/**
 * Stripe React Client using @stripe/stripe-js SDK
 * This provides direct Stripe SDK integration for React applications
 */
export class StripeReactClient {
    private stripePromise: Promise<StripeSDK> | null = null;
    private publishableKey: string;
    private baseURL?: string;

    constructor(options: StripeClientOptions) {
        this.publishableKey = options.publishableKey;
        this.baseURL = options.baseURL;
    }

    /**
     * Get the Stripe instance
     */
    async getStripe(): Promise<StripeSDK> {
        if (!this.stripePromise) {
            const mod = await getStripeModule();
            this.stripePromise = mod.loadStripe(this.publishableKey);
        }
        return await this.stripePromise;
    }

    /**
     * Confirm payment using Stripe Elements or PaymentRequest
     */
    async confirmPayment(clientSecret: string, elements?: any, options?: any): Promise<{ paymentIntent?: any; error?: any }> {
        const stripe = await this.getStripe();
        if (!stripe) {
            throw new KuluPayError("stripe_init_failed", "Stripe failed to initialize", 500);
        }

        if (elements) {
            // Confirm with Elements
            const { error, paymentIntent } = await stripe.confirmPayment({
                elements,
                clientSecret,
                confirmParams: options?.confirmParams,
                redirect: options?.redirect ?? 'if_required'
            });
            return { paymentIntent, error };
        } else {
            // Confirm with payment method
            const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, options);
            return { paymentIntent, error };
        }
    }

    /**
     * Create a payment intent via backend API
     */
    async createIntent(data: CreateIntentData): Promise<PaymentIntent> {
        if (!this.baseURL) {
            throw new KuluPayError("missing_base_url", "baseURL is required for API calls", 400);
        }

        const res = await fetch(`${this.baseURL.replace(/\/$/, "")}/create-intent`, {
            method: "POST",
            body: JSON.stringify({ ...data, providerId: "stripe" }),
            headers: {
                "Content-Type": "application/json",
            },
        });

        const responseData = (await res.json().catch(() => ({ error: "Unknown error" }))) as any;

        if (responseData.error) {
            throw new KuluPayError(responseData.code || "INTERNAL_ERROR", responseData.error, res.status);
        }

        if (!res.ok) {
            throw new KuluPayError(responseData.code || "INTERNAL_ERROR", responseData.error || "Request failed", res.status);
        }

        return responseData as PaymentIntent;
    }

    /**
     * Get payment intent via backend API
     */
    async getIntent(id: string): Promise<PaymentIntent> {
        if (!this.baseURL) {
            throw new KuluPayError("missing_base_url", "baseURL is required for API calls", 400);
        }

        const query = new URLSearchParams({ id, providerId: "stripe" });
        const res = await fetch(`${this.baseURL.replace(/\/$/, "")}/get-intent?${query.toString()}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        });

        const responseData = (await res.json().catch(() => ({ error: "Unknown error" }))) as any;

        if (responseData.error) {
            throw new KuluPayError(responseData.code || "INTERNAL_ERROR", responseData.error, res.status);
        }

        if (!res.ok) {
            throw new KuluPayError(responseData.code || "INTERNAL_ERROR", responseData.error || "Request failed", res.status);
        }

        return responseData as PaymentIntent;
    }

    /**
     * Handle payment method creation
     */
    async createPaymentMethod(paymentMethodData: any): Promise<any> {
        const stripe = await this.getStripe();
        if (!stripe) {
            throw new KuluPayError("stripe_init_failed", "Stripe failed to initialize", 500);
        }

        const { error, paymentMethod } = await stripe.createPaymentMethod(paymentMethodData);
        if (error) {
            throw new KuluPayError("payment_method_failed", error.message ?? "Payment method failed", 400);
        }
        return paymentMethod;
    }

    /**
     * Handle payment request button
     */
    async handlePaymentRequest(paymentRequest: any): Promise<any> {
        const stripe = await this.getStripe();
        if (!stripe) {
            throw new KuluPayError("stripe_init_failed", "Stripe failed to initialize", 500);
        }

        return paymentRequest;
    }
}

/**
 * Create a Stripe React client
 */
export const createStripeClient = (options: StripeClientOptions) => {
    return new StripeReactClient(options);
};
