import { useState, useCallback } from 'react';
import type { CreateIntentData, PaymentIntent } from '@kulupay/core';
import { KuluPayClient } from './vanilla';

export interface UsePaymentOptions {
    baseURL: string;
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
 * Generic React hook for payment operations with any provider.
 */
export const usePayment = ({
    baseURL,
    providerId,
    headers
}: UsePaymentOptions): UsePaymentReturn => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const client = new KuluPayClient({ baseURL, providerId, headers });

    const createIntent = useCallback(async (data: CreateIntentData): Promise<PaymentIntent> => {
        setLoading(true);
        setError(null);
        try {
            const intent = await client.createIntent(data);
            return intent;
        } catch (err: any) {
            setError(err.message || 'Failed to create payment intent');
            throw err;
        } finally {
            setLoading(false);
        }
    }, [client]);

    const getIntent = useCallback(async (id: string): Promise<PaymentIntent> => {
        setLoading(true);
        setError(null);
        try {
            const intent = await client.getIntent(id);
            return intent;
        } catch (err: any) {
            setError(err.message || 'Failed to get payment intent');
            throw err;
        } finally {
            setLoading(false);
        }
    }, [client]);

    return {
        createIntent,
        getIntent,
        loading,
        error
    };
};
