import type {
    PaymentClientProvider,
    PaymentConfirmOptions,
    PaymentIntent,
} from "@kulupay/core";
import { KuluPayClientError } from "../error";

export interface ChapaClientProviderOptions {
    /** Optional: override the default redirect behavior */
    redirectImmediately?: boolean;
}

/**
 * Chapa implementation of PaymentClientProvider.
 *
 * Chapa is a redirect-based provider — the server returns a checkout_url
 * as the clientSecret. The client provider simply redirects the user
 * to that URL. After payment, Chapa redirects back to the callback_url.
 *
 * No SDK is needed on the client side.
 *
 * @example
 * ```ts
 * const chapaProvider = createChapaClientProvider();
 *
 * // After createIntent returns a clientSecret (checkout_url):
 * await chapaProvider.confirmPayment(checkoutUrl, {
 *   redirectUrl: "https://yoursite.com/success",
 * });
 * ```
 */
export class ChapaClientProvider implements PaymentClientProvider {
    id = "chapa";
    private redirectImmediately: boolean;

    constructor(options?: ChapaClientProviderOptions) {
        this.redirectImmediately = options?.redirectImmediately ?? true;
    }

    async confirmPayment(
        clientSecret: string,
        options?: PaymentConfirmOptions,
    ): Promise<PaymentIntent> {
        if (!clientSecret) {
            throw new KuluPayClientError(
                "chapa_no_checkout_url",
                "No checkout URL returned from server. The clientSecret should contain the Chapa checkout URL.",
                400,
            );
        }

        if (this.redirectImmediately && typeof window !== "undefined") {
            window.location.href = clientSecret;
        }

        return {
            id: options?.intentId ?? "chapa_intent",
            amount: 0,
            currency: "ETB",
            status: "pending",
            clientSecret,
        };
    }

    async verifyPayment(_clientSecret: string): Promise<PaymentIntent> {
        throw new KuluPayClientError(
            "chapa_verify_not_supported",
            "Chapa does not support client-side payment verification. Use server-side getIntent or webhook events instead.",
            400,
        );
    }
}

/**
 * Create a Chapa client provider for redirect-based checkout.
 *
 * @example
 * ```ts
 * const chapaProvider = createChapaClientProvider();
 * ```
 */
export const createChapaClientProvider = (options?: ChapaClientProviderOptions) => {
    return new ChapaClientProvider(options);
};
