import { describe, it, expect } from "vitest";
import { getKuluPayTables } from "../get-tables";
import type { KuluPayOptions } from "../../types";

const baseOptions: KuluPayOptions = {
    database: {},
};

function getModels(options: KuluPayOptions) {
    return (getKuluPayTables(options) as any).models;
}

describe("getKuluPayTables", () => {
    describe("default table names", () => {
        it("should use default table names when no options provided", () => {
            const models = getModels(baseOptions);
            expect(models.payment.table).toBe("payment");
            expect(models.customer.table).toBe("customer");
            expect(models.subscription.table).toBe("subscription");
        });

        it("should use default table names when empty options provided", () => {
            const models = getModels({ ...baseOptions, payment: {}, customer: {}, subscription: {} });
            expect(models.payment.table).toBe("payment");
            expect(models.customer.table).toBe("customer");
            expect(models.subscription.table).toBe("subscription");
        });
    });

    describe("custom modelName", () => {
        it("should use custom modelName for payment", () => {
            const models = getModels({
                ...baseOptions,
                payment: { modelName: "payments" },
            });
            expect(models.payment.table).toBe("payments");
        });

        it("should use custom modelName for customer", () => {
            const models = getModels({
                ...baseOptions,
                customer: { modelName: "customers" },
            });
            expect(models.customer.table).toBe("customers");
        });

        it("should use custom modelName for subscription", () => {
            const models = getModels({
                ...baseOptions,
                subscription: { modelName: "subscriptions" },
            });
            expect(models.subscription.table).toBe("subscriptions");
        });

        it("should use custom modelName for all tables at once", () => {
            const models = getModels({
                ...baseOptions,
                payment: { modelName: "payments" },
                customer: { modelName: "customers" },
                subscription: { modelName: "subscriptions" },
            });
            expect(models.payment.table).toBe("payments");
            expect(models.customer.table).toBe("customers");
            expect(models.subscription.table).toBe("subscriptions");
        });
    });

    describe("base fields", () => {
        it("should include all base fields in payment table", () => {
            const models = getModels(baseOptions);
            const fields = models.payment.fields;
            expect(fields).toHaveProperty("id");
            expect(fields).toHaveProperty("userId");
            expect(fields).toHaveProperty("amount");
            expect(fields).toHaveProperty("currency");
            expect(fields).toHaveProperty("status");
            expect(fields).toHaveProperty("providerId");
            expect(fields).toHaveProperty("metadata");
            expect(fields).toHaveProperty("createdAt");
            expect(fields).toHaveProperty("updatedAt");
        });

        it("should include all base fields in customer table", () => {
            const models = getModels(baseOptions);
            const fields = models.customer.fields;
            expect(fields).toHaveProperty("id");
            expect(fields).toHaveProperty("userId");
            expect(fields).toHaveProperty("providerId");
            expect(fields).toHaveProperty("providerCustomerId");
            expect(fields).toHaveProperty("createdAt");
            expect(fields).toHaveProperty("updatedAt");
        });

        it("should include all base fields in subscription table", () => {
            const models = getModels(baseOptions);
            const fields = models.subscription.fields;
            expect(fields).toHaveProperty("id");
            expect(fields).toHaveProperty("userId");
            expect(fields).toHaveProperty("planId");
            expect(fields).toHaveProperty("status");
            expect(fields).toHaveProperty("providerSubscriptionId");
            expect(fields).toHaveProperty("currentPeriodEnd");
            expect(fields).toHaveProperty("cancelAtPeriodEnd");
            expect(fields).toHaveProperty("createdAt");
            expect(fields).toHaveProperty("updatedAt");
        });
    });

    describe("additionalFields", () => {
        it("should merge additionalFields into payment table", () => {
            const models = getModels({
                ...baseOptions,
                payment: {
                    additionalFields: {
                        description: { type: "string", required: false },
                    },
                },
            });
            expect(models.payment.fields).toHaveProperty("description");
        });

        it("should merge additionalFields into customer table", () => {
            const models = getModels({
                ...baseOptions,
                customer: {
                    additionalFields: {
                        country: { type: "string", required: false },
                    },
                },
            });
            expect(models.customer.fields).toHaveProperty("country");
        });

        it("should merge additionalFields into subscription table", () => {
            const models = getModels({
                ...baseOptions,
                subscription: {
                    additionalFields: {
                        trialEnd: { type: "datetime", required: false },
                    },
                },
            });
            expect(models.subscription.fields).toHaveProperty("trialEnd");
        });

        it("should preserve base fields when additionalFields are provided", () => {
            const models = getModels({
                ...baseOptions,
                payment: {
                    additionalFields: {
                        description: { type: "string", required: false },
                    },
                },
            });
            const fields = models.payment.fields;
            expect(fields).toHaveProperty("id");
            expect(fields).toHaveProperty("amount");
            expect(fields).toHaveProperty("description");
        });

        it("should handle multiple additionalFields", () => {
            const models = getModels({
                ...baseOptions,
                payment: {
                    additionalFields: {
                        description: { type: "string", required: false },
                        receiptEmail: { type: "string", required: false },
                        priority: { type: "number", required: false },
                    },
                },
            });
            const fields = models.payment.fields;
            expect(fields).toHaveProperty("description");
            expect(fields).toHaveProperty("receiptEmail");
            expect(fields).toHaveProperty("priority");
        });

        it("should handle no additionalFields gracefully", () => {
            const models = getModels(baseOptions);
            const fields = models.payment.fields;
            expect(fields).toHaveProperty("id");
            expect(fields).toHaveProperty("amount");
        });

        it("should support all field types", () => {
            const models = getModels({
                ...baseOptions,
                payment: {
                    additionalFields: {
                        strField: { type: "string", required: true },
                        numField: { type: "number", required: false },
                        boolField: { type: "boolean", required: false },
                        dateField: { type: "datetime", required: false },
                        jsonField: { type: "json", required: false },
                    },
                },
            });
            const fields = models.payment.fields;
            expect(fields).toHaveProperty("strField");
            expect(fields).toHaveProperty("numField");
            expect(fields).toHaveProperty("boolField");
            expect(fields).toHaveProperty("dateField");
            expect(fields).toHaveProperty("jsonField");
        });
    });

    describe("combined customization", () => {
        it("should support modelName and additionalFields together", () => {
            const models = getModels({
                ...baseOptions,
                payment: {
                    modelName: "payments",
                    additionalFields: {
                        description: { type: "string", required: false },
                    },
                },
            });
            expect(models.payment.table).toBe("payments");
            expect(models.payment.fields).toHaveProperty("description");
            expect(models.payment.fields).toHaveProperty("id");
        });

        it("should support different customizations per table independently", () => {
            const models = getModels({
                ...baseOptions,
                payment: {
                    modelName: "payments",
                    additionalFields: {
                        description: { type: "string", required: false },
                    },
                },
                customer: {
                    modelName: "customers",
                    additionalFields: {
                        country: { type: "string", required: false },
                    },
                },
                subscription: {
                    additionalFields: {
                        trialEnd: { type: "datetime", required: false },
                    },
                },
            });
            expect(models.payment.table).toBe("payments");
            expect(models.payment.fields).toHaveProperty("description");

            expect(models.customer.table).toBe("customers");
            expect(models.customer.fields).toHaveProperty("country");

            expect(models.subscription.table).toBe("subscription");
            expect(models.subscription.fields).toHaveProperty("trialEnd");
        });
    });
});
