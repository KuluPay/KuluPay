import { APIError } from "better-call";
import { KULUPAY_ERROR_CODES } from "./codes";
import type { KuluPayErrorCode } from "./codes";

export { KULUPAY_ERROR_CODES, type KuluPayErrorCode } from "./codes";
export { defineErrorCodes, type RawError } from "../utils/error-codes";

export class KuluPayError extends Error {
    constructor(message: string, public code?: string) {
        super(message);
        this.name = "KuluPayError";
    }
}

export class ProviderError extends KuluPayError {
    constructor(message: string, public providerId: string, public raw?: any) {
        super(message, "PROVIDER_ERROR");
        this.name = "ProviderError";
    }
}

export class ValidationError extends KuluPayError {
    constructor(message: string) {
        super(message, "VALIDATION_ERROR");
        this.name = "ValidationError";
    }
}

export class KuluPayAPIError extends APIError {
    constructor(
        status: number,
        public code: string,
        message: string,
        public data?: any,
    ) {
        super(status as any, {
            message,
            error: {
                code,
                message,
                ...(data ? { data } : {}),
            },
        });
        this.name = "APIError";
    }

    static from(
        status: number,
        error: { code: string; message: string },
        data?: any,
    ): KuluPayAPIError {
        return new KuluPayAPIError(status, error.code, error.message, data);
    }

    static fromCode(code: KuluPayErrorCode, status?: number, data?: any): KuluPayAPIError {
        const entry = KULUPAY_ERROR_CODES[code];
        const defaultStatus: Record<string, number> = {
            UNAUTHORIZED: 401,
            FORBIDDEN: 403,
            INVALID_ORIGIN: 403,
            MISSING_OR_NULL_ORIGIN: 403,
            PROVIDER_NOT_FOUND: 404,
            PROVIDER_NOT_CONFIGURED: 400,
            PROVIDER_SDK_NOT_FOUND: 500,
            PROVIDER_ERROR: 502,
            PROVIDER_METHOD_NOT_SUPPORTED: 400,
            PRICING_RESOLVE_FAILED: 500,
            PRICING_PRODUCT_NOT_FOUND: 404,
            PRICING_AMOUNT_MUST_BE_POSITIVE: 400,
            PRICING_CURRENCY_REQUIRED: 400,
            PRICING_RESOLVER_NOT_CONFIGURED: 500,
            PAYMENT_NOT_FOUND: 404,
            PAYMENT_ALREADY_SUCCEEDED: 400,
            PAYMENT_ALREADY_CANCELED: 400,
            PAYMENT_CANNOT_BE_CANCELED: 400,
            INVALID_AMOUNT: 400,
            INVALID_CURRENCY: 400,
            SUBSCRIPTION_NOT_FOUND: 404,
            SUBSCRIPTION_ALREADY_ACTIVE: 400,
            SUBSCRIPTION_NOT_CANCELLABLE: 400,
            SUBSCRIPTION_NOT_ACTIVE: 400,
            CUSTOMER_NOT_FOUND: 404,
            CUSTOMER_ALREADY_EXISTS: 409,
            WEBHOOK_SIGNATURE_INVALID: 400,
            WEBHOOK_SECRET_MISSING: 500,
            WEBHOOK_EVENT_ALREADY_PROCESSED: 200,
            WEBHOOK_PROVIDER_MISMATCH: 400,
            ANALYTICS_QUERY_FAILED: 500,
            ANALYTICS_INVALID_DATE_RANGE: 400,
            VALIDATION_ERROR: 400,
            MISSING_FIELD: 400,
            INVALID_REQUEST_BODY: 400,
            BODY_MUST_BE_AN_OBJECT: 400,
            DATABASE_ERROR: 500,
            INTERNAL_ERROR: 500,
        };
        return new KuluPayAPIError(
            status ?? defaultStatus[code] ?? 500,
            entry.code,
            entry.message,
            data,
        );
    }

    toJSON() {
        return {
            error: (this.body as { error: { code: string; message: string; data?: any } }).error,
        };
    }
}
