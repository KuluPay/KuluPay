import type { CreateIntentData, PaymentIntent } from "@kulupay/core";
import { KuluPayClientError } from "./error";

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

        if (!res.ok) {
            const errorBody = await res.json().catch(() => ({ error: { code: "INTERNAL_ERROR", message: "Request failed" } })) as any;
            const error = errorBody?.error || errorBody;
            throw new KuluPayClientError(
                error?.code || "INTERNAL_ERROR",
                error?.message || "Request failed",
                res.status,
                error?.data,
            );
        }

        return res.json().catch(() => ({})) as Promise<T>;
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

    async listPayments(params?: {
        status?: string;
        providerId?: string;
        limit?: number;
        offset?: number;
        startDate?: string;
        endDate?: string;
        expand?: string[];
        all?: boolean;
    }): Promise<{ data: any[]; total: number; limit: number; offset: number }> {
        const query = new URLSearchParams();
        if (params?.status) query.append('status', params.status);
        if (params?.providerId) query.append('providerId', params.providerId);
        else if (this._providerId) query.append('providerId', this._providerId);
        if (params?.limit) query.append('limit', String(params.limit));
        if (params?.offset) query.append('offset', String(params.offset));
        if (params?.startDate) query.append('startDate', params.startDate);
        if (params?.endDate) query.append('endDate', params.endDate);
        if (params?.expand?.length) query.append('expand', params.expand.join(","));
        if (params?.all) query.append('all', 'true');
        return this.request(`list-payments?${query.toString()}`, 'GET');
    }

    async getAnalytics(params?: {
        startDate?: string;
        endDate?: string;
        providerId?: string;
        groupBy?: string;
    }): Promise<any> {
        const query = new URLSearchParams();
        if (params?.startDate) query.append('startDate', params.startDate);
        if (params?.endDate) query.append('endDate', params.endDate);
        if (params?.providerId) query.append('providerId', params.providerId);
        if (params?.groupBy) query.append('groupBy', params.groupBy);
        return this.request(`analytics?${query.toString()}`, 'GET');
    }

    async createCustomer(data: {
        email?: string;
        name?: string;
        metadata?: Record<string, any>;
    }): Promise<any> {
        return this.request('create-customer', 'POST', {
            ...data,
            providerId: this._providerId,
        });
    }

    async getCustomer(id: string): Promise<any> {
        const query = new URLSearchParams({ id });
        if (this._providerId) query.append('providerId', this._providerId);
        return this.request(`get-customer?${query.toString()}`, 'GET');
    }

    async createSubscription(data: {
        customerId: string;
        planId: string;
        metadata?: Record<string, any>;
    }): Promise<any> {
        return this.request('create-subscription', 'POST', {
            ...data,
            providerId: this._providerId,
        });
    }

    async getSubscription(id: string): Promise<any> {
        const query = new URLSearchParams({ id });
        if (this._providerId) query.append('providerId', this._providerId);
        return this.request(`get-subscription?${query.toString()}`, 'GET');
    }

    async cancelSubscription(id: string): Promise<any> {
        return this.request('cancel-subscription', 'POST', {
            id,
            providerId: this._providerId,
        });
    }

    async listSubscriptions(params?: {
        status?: string;
        all?: boolean;
    }): Promise<{ data: any[]; total: number }> {
        const query = new URLSearchParams();
        if (params?.status) query.append('status', params.status);
        if (params?.all) query.append('all', 'true');
        return this.request(`list-subscriptions?${query.toString()}`, 'GET');
    }

    async refundPayment(id: string, amount?: number): Promise<any> {
        return this.request('refund', 'POST', {
            id,
            ...(amount ? { amount } : {}),
            providerId: this._providerId,
        });
    }

    async capturePayment(id: string, amount?: number): Promise<any> {
        return this.request('capture', 'POST', {
            id,
            ...(amount ? { amount } : {}),
            providerId: this._providerId,
        });
    }
}
