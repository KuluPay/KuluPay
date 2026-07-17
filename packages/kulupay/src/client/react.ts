import { useState, useCallback, useRef } from 'react';
import type { CreateIntentData, PaymentIntent } from '@kulupay/core';
import { KuluPayClient, KuluPayClientOptions } from './vanilla';

export interface UsePaymentOptions {
    providerId?: string;
    headers?: Record<string, string>;
}

export interface UsePaymentReturn {
    createIntent: (data: CreateIntentData) => Promise<PaymentIntent>;
    getIntent: (id: string) => Promise<PaymentIntent>;
    loading: boolean;
    error: string | null;
}

/**
 * Creates a React hook bound to a KuluPayClient instance.
 * Following the better-auth pattern where hooks are methods on the client.
 *
 * @example
 * ```ts
 * // lib/pay.ts
 * export const payClient = createKuluPayClient({ baseURL: "/api/pay" });
 *
 * // component.tsx
 * const { createIntent, loading, error } = payClient.usePayment({ providerId: "mock" });
 * ```
 */
export function createKuluPayReactHooks(client: KuluPayClient) {
    const usePayment = ({ providerId, headers }: UsePaymentOptions = {}): UsePaymentReturn => {
        const [loading, setLoading] = useState(false);
        const [error, setError] = useState<string | null>(null);

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
                const intent = await clientRef.current!.createIntent(data);
                return intent;
            } catch (err: any) {
                setError(err.message || 'Failed to create payment intent');
                throw err;
            } finally {
                setLoading(false);
            }
        }, []);

        const getIntent = useCallback(async (id: string): Promise<PaymentIntent> => {
            setLoading(true);
            setError(null);
            try {
                const intent = await clientRef.current!.getIntent(id);
                return intent;
            } catch (err: any) {
                setError(err.message || 'Failed to get payment intent');
                throw err;
            } finally {
                setLoading(false);
            }
        }, []);

        return {
            createIntent,
            getIntent,
            loading,
            error
        };
    };

    return { usePayment };
}

/**
 * Standalone usePayment hook (backward compatible).
 * Prefer creating a client with createKuluPayClient and using client.usePayment().
 */
export const usePayment = (options: KuluPayClientOptions & { providerId?: string }): UsePaymentReturn => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const clientRef = useRef<KuluPayClient | undefined>(undefined);
    if (!clientRef.current) {
        clientRef.current = new KuluPayClient(options);
    }

    const createIntent = useCallback(async (data: CreateIntentData): Promise<PaymentIntent> => {
        setLoading(true);
        setError(null);
        try {
            const intent = await clientRef.current!.createIntent(data);
            return intent;
        } catch (err: any) {
            setError(err.message || 'Failed to create payment intent');
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const getIntent = useCallback(async (id: string): Promise<PaymentIntent> => {
        setLoading(true);
        setError(null);
        try {
            const intent = await clientRef.current!.getIntent(id);
            return intent;
        } catch (err: any) {
            setError(err.message || 'Failed to get payment intent');
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        createIntent,
        getIntent,
        loading,
        error
    };
};
