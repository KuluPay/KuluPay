import type {
    PaymentClientProvider,
    PaymentConfirmOptions,
    PaymentIntent,
    PaymentStatus,
} from "@kulupay/core";
import { KuluPayClientError } from "../error";

type StripeSDK = NonNullable<Awaited<ReturnType<typeof import("@stripe/stripe-js").loadStripe>>>;

let stripeModulePromise: Promise<typeof import("@stripe/stripe-js")> | null = null;

const getStripeModule = async () => {
    if (!stripeModulePromise) {
        stripeModulePromise = import("@stripe/stripe-js").catch(() => {
            throw new KuluPayClientError(
                "stripe_sdk_missing",
                "@stripe/stripe-js not found. Install with: npm install @stripe/stripe-js",
                500,
            );
        });
    }
    return stripeModulePromise;
};

const mapStripeStatus = (status: string): PaymentStatus => {
    switch (status) {
        case "requires_payment_method":
        case "requires_confirmation":
        case "requires_action":
            return "pending";
        case "processing":
            return "processing";
        case "succeeded":
            return "succeeded";
        case "canceled":
            return "canceled";
        default:
            return "failed";
    }
};

export interface StripeClientProviderOptions {
    publishableKey: string;
}

/**
 * Stripe implementation of PaymentClientProvider.
 *
 * Wraps @stripe/stripe-js for client-side payment confirmation.
 * Works with KuluPayClient for the full flow:
 *
 * 1. KuluPayClient.createIntent() → server creates Stripe PaymentIntent → returns clientSecret
 * 2. StripeClientProvider.confirmPayment(clientSecret, { elements }) → Stripe.js confirms
 *
 * @example
 * ```ts
 * const stripeProvider = createStripeClientProvider({
 *   publishableKey: "pk_test_...",
 * });
 *
 * // In React:
 * const stripe = await stripeProvider.getSDK();
 * const elements = stripe.elements({ clientSecret });
 * // ... mount elements ...
 * const result = await stripeProvider.confirmPayment(clientSecret, { elements });
 * ```
 */
export class StripeClientProvider implements PaymentClientProvider {
    id = "stripe";
    private stripePromise: Promise<StripeSDK | null> | null = null;
    private publishableKey: string;

    constructor(options: StripeClientProviderOptions) {
        this.publishableKey = options.publishableKey;
    }

    async getSDK(): Promise<StripeSDK> {
        if (!this.stripePromise) {
            const mod = await getStripeModule();
            this.stripePromise = mod.loadStripe(this.publishableKey);
        }
        const stripe = await this.stripePromise;
        if (!stripe) {
            throw new KuluPayClientError(
                "stripe_init_failed",
                "Stripe failed to initialize. Check your publishable key.",
                500,
            );
        }
        return stripe;
    }

    async createElements(options?: { clientSecret: string; appearance?: any }): Promise<any> {
        const stripe = await this.getSDK();
        return (stripe as any).elements({
            clientSecret: options?.clientSecret,
            appearance: options?.appearance,
        });
    }

    async confirmPayment(
        clientSecret: string,
        options?: PaymentConfirmOptions,
    ): Promise<PaymentIntent> {
        const stripe = await this.getSDK();

        if (options?.elements) {
            const { error: submitError } = await options.elements.submit();
            if (submitError) {
                throw new KuluPayClientError(
                    "stripe_confirm_failed",
                    submitError.message ?? "Payment validation failed",
                    400,
                    { stripeError: submitError },
                );
            }

            const result = await (stripe as any).confirmPayment({
                elements: options.elements,
                clientSecret,
                confirmParams: {
                    return_url: options.redirectUrl,
                    ...options.confirmParams,
                },
                redirect: options.redirect ?? "if_required",
            });

            if (result.error) {
                throw new KuluPayClientError(
                    "stripe_confirm_failed",
                    result.error.message ?? "Payment confirmation failed",
                    400,
                    { stripeError: result.error },
                );
            }

            const pi = result.paymentIntent;
            return {
                id: pi.id,
                amount: pi.amount,
                currency: pi.currency,
                status: mapStripeStatus(pi.status),
                clientSecret: pi.client_secret ?? clientSecret,
                providerPaymentId: pi.id,
                raw: pi,
            };
        }

        const result = await (stripe as any).confirmCardPayment(
            clientSecret,
            options?.paymentMethodData,
        );

        if (result.error) {
            throw new KuluPayClientError(
                "stripe_confirm_failed",
                result.error.message ?? "Payment confirmation failed",
                400,
                { stripeError: result.error },
            );
        }

        const pi = result.paymentIntent;
        return {
            id: pi.id,
            amount: pi.amount,
            currency: pi.currency,
            status: mapStripeStatus(pi.status),
            clientSecret: pi.client_secret ?? clientSecret,
            providerPaymentId: pi.id,
            raw: pi,
        };
    }

    async createPaymentMethod(data: any): Promise<any> {
        const stripe = await this.getSDK();
        const { error, paymentMethod } = await (stripe as any).createPaymentMethod(data);
        if (error) {
            throw new KuluPayClientError(
                "payment_method_failed",
                error.message ?? "Failed to create payment method",
                400,
                { stripeError: error },
            );
        }
        return paymentMethod;
    }

    async verifyPayment(clientSecret: string): Promise<PaymentIntent> {
        const stripe = await this.getSDK();
        const { paymentIntent } = await (stripe as any).retrievePaymentIntent(clientSecret);
        if (!paymentIntent) {
            throw new KuluPayClientError(
                "stripe_retrieve_failed",
                "Failed to retrieve payment intent",
                404,
            );
        }
        return {
            id: paymentIntent.id,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
            status: mapStripeStatus(paymentIntent.status),
            clientSecret: paymentIntent.client_secret ?? clientSecret,
            providerPaymentId: paymentIntent.id,
            raw: paymentIntent,
        };
    }
}

/**
 * Create a Stripe client provider for browser-side payment confirmation.
 *
 * @example
 * ```ts
 * const stripe = createStripeClientProvider({
 *   publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
 * });
 * ```
 */
export const createStripeClientProvider = (options: StripeClientProviderOptions) => {
    return new StripeClientProvider(options);
};
