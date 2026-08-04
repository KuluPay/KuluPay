import { describe, it, expect } from "vitest";
import { KuluPayAPIError, KULUPAY_ERROR_CODES } from "../error";
import { STRIPE_ERROR_CODES } from "../payment-providers/stripe/error-codes";
import { CHAPA_ERROR_CODES } from "../payment-providers/chapa/error-codes";
import { defineErrorCodes } from "../utils/error-codes";

describe("Error System", () => {
    describe("defineErrorCodes", () => {
        it("should create error codes with code and message", () => {
            const codes = defineErrorCodes({
                TEST_ERROR: "Test error message",
                ANOTHER_ERROR: "Another error",
            });

            expect(codes.TEST_ERROR.code).toBe("TEST_ERROR");
            expect(codes.TEST_ERROR.message).toBe("Test error message");
            expect(codes.ANOTHER_ERROR.code).toBe("ANOTHER_ERROR");
            expect(codes.ANOTHER_ERROR.message).toBe("Another error");
        });

        it("should enforce uppercase snake_case keys", () => {
            const codes = defineErrorCodes({
                VALID_KEY: "Valid",
            });

            expect(codes.VALID_KEY.code).toMatch(/^[A-Z][A-Z0-9_]*$/);
        });
    });

    describe("KULUPAY_ERROR_CODES", () => {
        it("should include auth error codes", () => {
            expect(KULUPAY_ERROR_CODES.UNAUTHORIZED).toBeDefined();
            expect(KULUPAY_ERROR_CODES.UNAUTHORIZED.code).toBe("UNAUTHORIZED");
            expect(KULUPAY_ERROR_CODES.FORBIDDEN).toBeDefined();
            expect(KULUPAY_ERROR_CODES.INVALID_ORIGIN).toBeDefined();
            expect(KULUPAY_ERROR_CODES.MISSING_OR_NULL_ORIGIN).toBeDefined();
        });

        it("should include provider error codes", () => {
            expect(KULUPAY_ERROR_CODES.PROVIDER_NOT_FOUND).toBeDefined();
            expect(KULUPAY_ERROR_CODES.PROVIDER_NOT_CONFIGURED).toBeDefined();
            expect(KULUPAY_ERROR_CODES.PROVIDER_SDK_NOT_FOUND).toBeDefined();
            expect(KULUPAY_ERROR_CODES.PROVIDER_ERROR).toBeDefined();
            expect(KULUPAY_ERROR_CODES.PROVIDER_METHOD_NOT_SUPPORTED).toBeDefined();
        });

        it("should include pricing error codes", () => {
            expect(KULUPAY_ERROR_CODES.PRICING_RESOLVE_FAILED).toBeDefined();
            expect(KULUPAY_ERROR_CODES.PRICING_PRODUCT_NOT_FOUND).toBeDefined();
            expect(KULUPAY_ERROR_CODES.PRICING_AMOUNT_MUST_BE_POSITIVE).toBeDefined();
            expect(KULUPAY_ERROR_CODES.PRICING_CURRENCY_REQUIRED).toBeDefined();
            expect(KULUPAY_ERROR_CODES.PRICING_RESOLVER_NOT_CONFIGURED).toBeDefined();
        });

        it("should include payment error codes", () => {
            expect(KULUPAY_ERROR_CODES.PAYMENT_NOT_FOUND).toBeDefined();
            expect(KULUPAY_ERROR_CODES.PAYMENT_ALREADY_SUCCEEDED).toBeDefined();
            expect(KULUPAY_ERROR_CODES.PAYMENT_ALREADY_CANCELED).toBeDefined();
            expect(KULUPAY_ERROR_CODES.INVALID_AMOUNT).toBeDefined();
            expect(KULUPAY_ERROR_CODES.INVALID_CURRENCY).toBeDefined();
        });

        it("should include subscription error codes", () => {
            expect(KULUPAY_ERROR_CODES.SUBSCRIPTION_NOT_FOUND).toBeDefined();
            expect(KULUPAY_ERROR_CODES.SUBSCRIPTION_ALREADY_ACTIVE).toBeDefined();
            expect(KULUPAY_ERROR_CODES.SUBSCRIPTION_NOT_CANCELLABLE).toBeDefined();
        });

        it("should include customer error codes", () => {
            expect(KULUPAY_ERROR_CODES.CUSTOMER_NOT_FOUND).toBeDefined();
            expect(KULUPAY_ERROR_CODES.CUSTOMER_ALREADY_EXISTS).toBeDefined();
        });

        it("should include webhook error codes", () => {
            expect(KULUPAY_ERROR_CODES.WEBHOOK_SIGNATURE_INVALID).toBeDefined();
            expect(KULUPAY_ERROR_CODES.WEBHOOK_SECRET_MISSING).toBeDefined();
            expect(KULUPAY_ERROR_CODES.WEBHOOK_EVENT_ALREADY_PROCESSED).toBeDefined();
            expect(KULUPAY_ERROR_CODES.WEBHOOK_PROVIDER_MISMATCH).toBeDefined();
        });

        it("should include analytics error codes", () => {
            expect(KULUPAY_ERROR_CODES.ANALYTICS_QUERY_FAILED).toBeDefined();
            expect(KULUPAY_ERROR_CODES.ANALYTICS_INVALID_DATE_RANGE).toBeDefined();
        });

        it("should include validation and server error codes", () => {
            expect(KULUPAY_ERROR_CODES.VALIDATION_ERROR).toBeDefined();
            expect(KULUPAY_ERROR_CODES.MISSING_FIELD).toBeDefined();
            expect(KULUPAY_ERROR_CODES.DATABASE_ERROR).toBeDefined();
            expect(KULUPAY_ERROR_CODES.INTERNAL_ERROR).toBeDefined();
        });
    });

    describe("STRIPE_ERROR_CODES", () => {
        it("should include Stripe-specific error codes", () => {
            expect(STRIPE_ERROR_CODES.STRIPE_CARD_DECLINED).toBeDefined();
            expect(STRIPE_ERROR_CODES.STRIPE_INSUFFICIENT_FUNDS).toBeDefined();
            expect(STRIPE_ERROR_CODES.STRIPE_EXPIRED_CARD).toBeDefined();
            expect(STRIPE_ERROR_CODES.STRIPE_INCORRECT_CVC).toBeDefined();
            expect(STRIPE_ERROR_CODES.STRIPE_PROCESSING_ERROR).toBeDefined();
            expect(STRIPE_ERROR_CODES.STRIPE_API_ERROR).toBeDefined();
            expect(STRIPE_ERROR_CODES.STRIPE_WEBHOOK_CONSTRUCTION_FAILED).toBeDefined();
            expect(STRIPE_ERROR_CODES.STRIPE_CUSTOMER_CREATION_FAILED).toBeDefined();
            expect(STRIPE_ERROR_CODES.STRIPE_SUBSCRIPTION_CREATION_FAILED).toBeDefined();
        });

        it("should have uppercase snake_case codes", () => {
            for (const key of Object.keys(STRIPE_ERROR_CODES)) {
                expect(key).toMatch(/^[A-Z][A-Z0-9_]*$/);
            }
        });
    });

    describe("CHAPA_ERROR_CODES", () => {
        it("should include Chapa-specific error codes", () => {
            expect(CHAPA_ERROR_CODES.CHAPA_API_ERROR).toBeDefined();
            expect(CHAPA_ERROR_CODES.CHAPA_VERIFICATION_FAILED).toBeDefined();
            expect(CHAPA_ERROR_CODES.CHAPA_REFUND_NOT_SUPPORTED).toBeDefined();
            expect(CHAPA_ERROR_CODES.CHAPA_SUBSCRIPTION_NOT_SUPPORTED).toBeDefined();
        });
    });
});

describe("KuluPayAPIError", () => {
    describe("constructor", () => {
        it("should create an error with status, code, and message", () => {
            const error = new KuluPayAPIError(400, "TEST_ERROR", "Test message");
            expect(error.status).toBe(400);
            expect(error.code).toBe("TEST_ERROR");
            expect(error.message).toBe("Test message");
            expect(error.name).toBe("APIError");
            expect(error instanceof Error).toBe(true);
        });

        it("should include data when provided", () => {
            const data = { field: "amount", reason: "invalid" };
            const error = new KuluPayAPIError(400, "VALIDATION_ERROR", "Invalid", data);
            expect(error.data).toEqual(data);
        });

        it("should have undefined data when not provided", () => {
            const error = new KuluPayAPIError(500, "INTERNAL_ERROR", "Internal");
            expect(error.data).toBeUndefined();
        });
    });

    describe("from()", () => {
        it("should create error from status + error object", () => {
            const error = KuluPayAPIError.from(502, {
                code: "PROVIDER_ERROR",
                message: "Stripe failed",
            });
            expect(error.status).toBe(502);
            expect(error.code).toBe("PROVIDER_ERROR");
            expect(error.message).toBe("Stripe failed");
        });

        it("should include data when provided", () => {
            const error = KuluPayAPIError.from(502, {
                code: "PROVIDER_ERROR",
                message: "Stripe failed",
            }, { raw: { type: "card_error" } });
            expect(error.data).toEqual({ raw: { type: "card_error" } });
        });
    });

    describe("fromCode()", () => {
        it("should create error with correct default status for UNAUTHORIZED", () => {
            const error = KuluPayAPIError.fromCode("UNAUTHORIZED");
            expect(error.status).toBe(401);
            expect(error.code).toBe("UNAUTHORIZED");
            expect(error.message).toBe("Unauthorized access");
        });

        it("should create error with correct default status for FORBIDDEN", () => {
            const error = KuluPayAPIError.fromCode("FORBIDDEN");
            expect(error.status).toBe(403);
        });

        it("should create error with correct default status for PAYMENT_NOT_FOUND", () => {
            const error = KuluPayAPIError.fromCode("PAYMENT_NOT_FOUND");
            expect(error.status).toBe(404);
        });

        it("should create error with correct default status for PROVIDER_ERROR", () => {
            const error = KuluPayAPIError.fromCode("PROVIDER_ERROR");
            expect(error.status).toBe(502);
        });

        it("should create error with correct default status for PRICING_RESOLVE_FAILED", () => {
            const error = KuluPayAPIError.fromCode("PRICING_RESOLVE_FAILED");
            expect(error.status).toBe(500);
        });

        it("should create error with correct default status for PRICING_AMOUNT_MUST_BE_POSITIVE", () => {
            const error = KuluPayAPIError.fromCode("PRICING_AMOUNT_MUST_BE_POSITIVE");
            expect(error.status).toBe(400);
        });

        it("should create error with correct default status for ANALYTICS_INVALID_DATE_RANGE", () => {
            const error = KuluPayAPIError.fromCode("ANALYTICS_INVALID_DATE_RANGE");
            expect(error.status).toBe(400);
        });

        it("should allow overriding the default status", () => {
            const error = KuluPayAPIError.fromCode("UNAUTHORIZED", 403);
            expect(error.status).toBe(403);
        });

        it("should include data when provided", () => {
            const error = KuluPayAPIError.fromCode("PRICING_RESOLVE_FAILED", 500, { cause: "DB timeout" });
            expect(error.data).toEqual({ cause: "DB timeout" });
        });

        it("should default to 500 for unknown codes", () => {
            const error = KuluPayAPIError.fromCode("INTERNAL_ERROR");
            expect(error.status).toBe(500);
        });

        it("should default to 500 for WEBHOOK_SECRET_MISSING", () => {
            const error = KuluPayAPIError.fromCode("WEBHOOK_SECRET_MISSING");
            expect(error.status).toBe(500);
        });
    });

    describe("toJSON()", () => {
        it("should serialize to { error: { code, message } }", () => {
            const error = new KuluPayAPIError(400, "INVALID_AMOUNT", "Invalid amount");
            const json = error.toJSON();
            expect(json).toEqual({
                error: {
                    code: "INVALID_AMOUNT",
                    message: "Invalid amount",
                },
            });
        });

        it("should include data in JSON when present", () => {
            const error = new KuluPayAPIError(400, "VALIDATION_ERROR", "Invalid", { field: "amount" });
            const json = error.toJSON();
            expect(json.error).toHaveProperty("data");
            expect((json.error as any).data).toEqual({ field: "amount" });
        });

        it("should not include data in JSON when absent", () => {
            const error = new KuluPayAPIError(404, "PAYMENT_NOT_FOUND", "Not found");
            const json = error.toJSON();
            expect(json.error).not.toHaveProperty("data");
        });
    });
});
