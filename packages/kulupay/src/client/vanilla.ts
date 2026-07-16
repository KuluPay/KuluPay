import type { CreateIntentData, PaymentIntent } from "@kulupay/core";
import { KuluPayError } from "./error";

export interface KuluPayClientOptions {
    baseURL: string;
    headers?: Record<string, string>;
    providerId?: string;
}

/**
 * Generic KuluPay client for any payment provider.
 * Works in browser or server-side JavaScript environments.
 */
export class KuluPayClient {
    private baseURL: string;
    private headers: Record<string, string>;
    private providerId?: string;

    constructor(options: KuluPayClientOptions) {
        this.baseURL = options.baseURL;
        this.headers = options.headers || {};
        this.providerId = options.providerId;
    }

    private async request<T>(path: string, method: string, body?: any): Promise<T> {
        const res = await fetch(`${this.baseURL.replace(/\/$/, '')}/${path}`, {
            method,
            body: body ? JSON.stringify(body) : undefined,
            headers: {
                'Content-Type': 'application/json',
                ...this.headers,
            },
        });

        const data = await res.json().catch(() => ({ error: 'Unknown error' })) as any;

        if (data.error) {
            throw new KuluPayError(data.error, data.code);
        }

        if (!res.ok) {
            throw new KuluPayError(data.error || 'Request failed', data.code);
        }

        return data;
    }

    async createIntent(data: CreateIntentData): Promise<PaymentIntent> {
        return this.request<PaymentIntent>('create-intent', 'POST', {
            ...data,
            providerId: this.providerId || data.providerId
        });
    }

    async getIntent(id: string): Promise<PaymentIntent> {
        const query = new URLSearchParams({ id });
        if (this.providerId) query.append('providerId', this.providerId);
        return this.request<PaymentIntent>(`get-intent?${query.toString()}`, 'GET');
    }
}

/**
 * Creates a vanilla KuluPay client.
 */
export const createKuluPayClient = (options: KuluPayClientOptions) => {
    return new KuluPayClient(options);
};
