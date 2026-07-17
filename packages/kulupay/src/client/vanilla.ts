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
 *
 * Following the better-auth pattern, the client is instantiated once
 * and exported. Methods are typed from the server endpoint definitions.
 */
export class KuluPayClient {
    private _baseURL: string;
    private _headers: Record<string, string>;
    private _providerId?: string;

    constructor(options: KuluPayClientOptions) {
        this._baseURL = options.baseURL;
        this._headers = options.headers || {};
        this._providerId = options.providerId;
    }

    get baseURL() { return this._baseURL; }
    get headers() { return this._headers; }
    get providerId() { return this._providerId; }

    private async request<T>(path: string, method: string, body?: any): Promise<T> {
        const res = await fetch(`${this._baseURL.replace(/\/$/, '')}/${path}`, {
            method,
            body: body ? JSON.stringify(body) : undefined,
            headers: {
                'Content-Type': 'application/json',
                ...this._headers,
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
            providerId: this._providerId || data.providerId
        });
    }

    async getIntent(id: string): Promise<PaymentIntent> {
        const query = new URLSearchParams({ id });
        if (this._providerId) query.append('providerId', this._providerId);
        return this.request<PaymentIntent>(`get-intent?${query.toString()}`, 'GET');
    }
}
