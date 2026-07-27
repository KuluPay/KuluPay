import { useState, useCallback, useRef, useEffect } from "react";
import type {
    CreateIntentData,
    PaymentIntent,
    PaymentClientProvider,
    PaymentConfirmOptions,
} from "@kulupay/core";
import { KuluPayClient, KuluPayClientOptions } from "./vanilla";
import { KuluPayClientError } from "./error";

export interface UsePaymentOptions {
    providerId?: string;
    headers?: Record<string, string>;
}

export interface UsePaymentReturn {
    createIntent: (data: CreateIntentData) => Promise<PaymentIntent>;
    getIntent: (id: string) => Promise<PaymentIntent>;
    loading: boolean;
    error: KuluPayClientError | null;
    intent: PaymentIntent | null;
}

export interface UsePaymentProviderOptions {
    client: KuluPayClient;
    provider: PaymentClientProvider;
    providerId?: string;
}

export interface UsePaymentProviderReturn {
    createIntent: (data: CreateIntentData) => Promise<PaymentIntent>;
    confirmPayment: (options?: PaymentConfirmOptions) => Promise<PaymentIntent>;
    getIntent: (id: string) => Promise<PaymentIntent>;
    verifyPayment: (id?: string) => Promise<PaymentIntent>;
    loading: boolean;
    error: KuluPayClientError | null;
    intent: PaymentIntent | null;
    sdk: any | null;
    elements: any | null;
    createElements: (options?: any) => Promise<any>;
}

/**
 * Creates React hooks bound to a KuluPayClient instance.
 * Following the better-auth pattern where hooks are methods on the client.
 */
export function createKuluPayReactHooks(client: KuluPayClient) {
    const usePayment = ({ providerId, headers }: UsePaymentOptions = {}): UsePaymentReturn => {
        const [loading, setLoading] = useState(false);
        const [error, setError] = useState<KuluPayClientError | null>(null);
        const [intent, setIntent] = useState<PaymentIntent | null>(null);

        const clientRef = useRef<KuluPayClient | undefined>(undefined);
        if (!clientRef.current) {
            clientRef.current = new KuluPayClient({
                baseURL: client.baseURL,
                providerId: providerId || client.providerId,
                headers: { ...client.headers, ...headers },
            });
        }

        const createIntent = useCallback(async (data: CreateIntentData): Promise<PaymentIntent> => {
            setLoading(true);
            setError(null);
            try {
                const result = await clientRef.current!.createIntent(data);
                setIntent(result);
                return result;
            } catch (err: any) {
                const clientError = err instanceof KuluPayClientError
                    ? err
                    : new KuluPayClientError("UNKNOWN", err.message || "Failed to create payment intent", 500);
                setError(clientError);
                throw clientError;
            } finally {
                setLoading(false);
            }
        }, []);

        const getIntent = useCallback(async (id: string): Promise<PaymentIntent> => {
            setLoading(true);
            setError(null);
            try {
                const result = await clientRef.current!.getIntent(id);
                setIntent(result);
                return result;
            } catch (err: any) {
                const clientError = err instanceof KuluPayClientError
                    ? err
                    : new KuluPayClientError("UNKNOWN", err.message || "Failed to get payment intent", 500);
                setError(clientError);
                throw clientError;
            } finally {
                setLoading(false);
            }
        }, []);

        return {
            createIntent,
            getIntent,
            loading,
            error,
            intent,
        };
    };

    return { usePayment };
}

/**
 * usePaymentProvider — full client-side payment flow hook.
 *
 * Combines KuluPayClient (API calls) with a PaymentClientProvider (SDK confirmation).
 * Gives you the complete end-to-end flow: create intent → mount elements → confirm.
 *
 * @example
 * ```tsx
 * const stripe = createStripeClientProvider({
 *   publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
 * });
 *
 * function Checkout() {
 *   const pay = usePaymentProvider({
 *     client: payClient,
 *     provider: stripe,
 *     providerId: "stripe",
 *   });
 *
 *   useEffect(() => {
 *     if (pay.intent?.clientSecret) {
 *       pay.createElements({ clientSecret: pay.intent.clientSecret });
 *     }
 *   }, [pay.intent]);
 *
 *   const handlePay = async () => {
 *     await pay.createIntent({ amount: 2500, currency: "usd", userId: "user_1", providerId: "stripe" });
 *   };
 *
 *   const handleConfirm = async () => {
 *     await pay.confirmPayment({ elements: pay.elements });
 *   };
 *
 *   return (...)
 * }
 * ```
 */
export function usePaymentProvider({
    client,
    provider,
    providerId,
}: UsePaymentProviderOptions): UsePaymentProviderReturn {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<KuluPayClientError | null>(null);
    const [intent, setIntent] = useState<PaymentIntent | null>(null);
    const [sdk, setSDK] = useState<any | null>(null);
    const [elements, setElements] = useState<any | null>(null);

    const providerClientRef = useRef<KuluPayClient | undefined>(undefined);
    if (!providerClientRef.current) {
        providerClientRef.current = new KuluPayClient({
            baseURL: client.baseURL,
            providerId: providerId || client.providerId,
            headers: client.headers,
        });
    }

    useEffect(() => {
        if (provider.getSDK) {
            provider.getSDK().then(setSDK).catch((err) => {
                setError(
                    err instanceof KuluPayClientError
                        ? err
                        : new KuluPayClientError("sdk_init_failed", err.message || "SDK initialization failed", 500),
                );
            });
        }
    }, [provider]);

    const createIntent = useCallback(async (data: CreateIntentData): Promise<PaymentIntent> => {
        setLoading(true);
        setError(null);
        try {
            const result = await providerClientRef.current!.createIntent({
                ...data,
                providerId: providerId || data.providerId || provider.id,
            });
            setIntent(result);
            return result;
        } catch (err: any) {
            const clientError = err instanceof KuluPayClientError
                ? err
                : new KuluPayClientError("UNKNOWN", err.message || "Failed to create payment intent", 500);
            setError(clientError);
            throw clientError;
        } finally {
            setLoading(false);
        }
    }, [providerId, provider.id]);

    const confirmPayment = useCallback(async (options?: PaymentConfirmOptions): Promise<PaymentIntent> => {
        if (!intent?.clientSecret) {
            const err = new KuluPayClientError(
                "no_intent",
                "No payment intent to confirm. Call createIntent first.",
                400,
            );
            setError(err);
            throw err;
        }
        setLoading(true);
        setError(null);
        try {
            const result = await provider.confirmPayment(intent.clientSecret, options);
            setIntent(result);
            return result;
        } catch (err: any) {
            const clientError = err instanceof KuluPayClientError
                ? err
                : new KuluPayClientError("confirm_failed", err.message || "Payment confirmation failed", 400);
            setError(clientError);
            throw clientError;
        } finally {
            setLoading(false);
        }
    }, [intent, provider]);

    const getIntent = useCallback(async (id: string): Promise<PaymentIntent> => {
        setLoading(true);
        setError(null);
        try {
            const result = await providerClientRef.current!.getIntent(id);
            setIntent(result);
            return result;
        } catch (err: any) {
            const clientError = err instanceof KuluPayClientError
                ? err
                : new KuluPayClientError("UNKNOWN", err.message || "Failed to get payment intent", 500);
            setError(clientError);
            throw clientError;
        } finally {
            setLoading(false);
        }
    }, []);

    const verifyPayment = useCallback(async (id?: string): Promise<PaymentIntent> => {
        const secret = id || intent?.clientSecret;
        if (!secret) {
            const err = new KuluPayClientError(
                "no_intent",
                "No payment intent to verify. Call createIntent first.",
                400,
            );
            setError(err);
            throw err;
        }
        if (!provider.verifyPayment) {
            const err = new KuluPayClientError(
                "not_supported",
                "This provider does not support payment verification.",
                400,
            );
            setError(err);
            throw err;
        }
        setLoading(true);
        setError(null);
        try {
            const result = await provider.verifyPayment(secret);
            setIntent(result);
            return result;
        } catch (err: any) {
            const clientError = err instanceof KuluPayClientError
                ? err
                : new KuluPayClientError("verify_failed", err.message || "Payment verification failed", 400);
            setError(clientError);
            throw clientError;
        } finally {
            setLoading(false);
        }
    }, [intent, provider]);

    const createElements = useCallback(async (options?: any): Promise<any> => {
        if (!provider.createElements) {
            throw new KuluPayClientError(
                "not_supported",
                "This provider does not support creating elements.",
                400,
            );
        }
        const els = await provider.createElements(options);
        setElements(els);
        return els;
    }, [provider]);

    return {
        createIntent,
        confirmPayment,
        getIntent,
        verifyPayment,
        loading,
        error,
        intent,
        sdk,
        elements,
        createElements,
    };
}

/**
 * Standalone usePayment hook (backward compatible).
 * Prefer createKuluPayClient + usePaymentProvider for new code.
 */
export const usePayment = (options: KuluPayClientOptions & { providerId?: string }): UsePaymentReturn => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<KuluPayClientError | null>(null);
    const [intent, setIntent] = useState<PaymentIntent | null>(null);

    const clientRef = useRef<KuluPayClient | undefined>(undefined);
    if (!clientRef.current) {
        clientRef.current = new KuluPayClient(options);
    }

    const createIntent = useCallback(async (data: CreateIntentData): Promise<PaymentIntent> => {
        setLoading(true);
        setError(null);
        try {
            const result = await clientRef.current!.createIntent(data);
            setIntent(result);
            return result;
        } catch (err: any) {
            const clientError = err instanceof KuluPayClientError
                ? err
                : new KuluPayClientError("UNKNOWN", err.message || "Failed to create payment intent", 500);
            setError(clientError);
            throw clientError;
        } finally {
            setLoading(false);
        }
    }, []);

    const getIntent = useCallback(async (id: string): Promise<PaymentIntent> => {
        setLoading(true);
        setError(null);
        try {
            const result = await clientRef.current!.getIntent(id);
            setIntent(result);
            return result;
        } catch (err: any) {
            const clientError = err instanceof KuluPayClientError
                ? err
                : new KuluPayClientError("UNKNOWN", err.message || "Failed to get payment intent", 500);
            setError(clientError);
            throw clientError;
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        createIntent,
        getIntent,
        loading,
        error,
        intent,
    };
};
