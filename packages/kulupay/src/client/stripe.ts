import { loadStripe, Stripe } from '@stripe/stripe-js';
import type { CreateIntentData, PaymentIntent } from "@kulupay/core";
import { KuluPayError } from "./error";

export interface StripeClientOptions {
    publishableKey: string;
    baseURL?: string;
}

/**
 * Stripe React Client using @stripe/stripe-js SDK
 * This provides direct Stripe SDK integration for React applications
 */
export class StripeReactClient {
    private stripePromise: Promise<Stripe | null>;
    private publishableKey: string;
    private baseURL?: string;

    constructor(options: StripeClientOptions) {
        this.publishableKey = options.publishableKey;
        this.baseURL = options.baseURL;
        this.stripePromise = loadStripe(this.publishableKey);
    }

    /**
     * Get the Stripe instance
     */
    async getStripe(): Promise<Stripe | null> {
        return await this.stripePromise;
    }

    /**
     * Confirm payment using Stripe Elements or PaymentRequest
     */
    async confirmPayment(clientSecret: string, elements?: any, options?: any): Promise<{ paymentIntent?: any; error?: any }> {
        const stripe = await this.getStripe();
        if (!stripe) {
            throw new KuluPayError("Stripe failed to initialize", "stripe_init_failed");
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
            throw new KuluPayError("baseURL is required for API calls", "missing_base_url");
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
            throw new KuluPayError(responseData.error, responseData.code);
        }

        if (!res.ok) {
            throw new KuluPayError(responseData.error || "Request failed", responseData.code);
        }

        return responseData as PaymentIntent;
    }

    /**
     * Get payment intent via backend API
     */
    async getIntent(id: string): Promise<PaymentIntent> {
        if (!this.baseURL) {
            throw new KuluPayError("baseURL is required for API calls", "missing_base_url");
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
            throw new KuluPayError(responseData.error, responseData.code);
        }

        if (!res.ok) {
            throw new KuluPayError(responseData.error || "Request failed", responseData.code);
        }

        return responseData as PaymentIntent;
    }

    /**
     * Handle payment method creation
     */
    async createPaymentMethod(paymentMethodData: any): Promise<any> {
        const stripe = await this.getStripe();
        if (!stripe) {
            throw new KuluPayError("Stripe failed to initialize", "stripe_init_failed");
        }

        const { error, paymentMethod } = await stripe.createPaymentMethod(paymentMethodData);
        if (error) {
            throw new KuluPayError(error.message ?? "Payment method failed", "payment_method_failed");
        }
        return paymentMethod;
    }

    /**
     * Handle payment request button
     */
    async handlePaymentRequest(paymentRequest: any): Promise<any> {
        const stripe = await this.getStripe();
        if (!stripe) {
            throw new KuluPayError("Stripe failed to initialize", "stripe_init_failed");
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
