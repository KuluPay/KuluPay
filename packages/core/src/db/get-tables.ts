import { defineSchema, model, id, string, decimal, datetime, boolean, json, integer, belongsTo, hasMany } from "@farming-labs/orm";
import type { KuluPayOptions, AdditionalField } from "../types";

const fieldTypeMap = {
    string: () => string(),
    number: () => integer(),
    boolean: () => boolean(),
    datetime: () => datetime(),
    json: () => json(),
} as const;

function buildAdditionalFields(additionalFields?: Record<string, AdditionalField>) {
    if (!additionalFields) return {};
    const result: Record<string, ReturnType<(typeof fieldTypeMap)[keyof typeof fieldTypeMap]>> = {};
    for (const [key, config] of Object.entries(additionalFields)) {
        const builder = fieldTypeMap[config.type];
        let field = builder();
        if (config.required === false) {
            (field as any).nullable = true;
        }
        if (config.unique) {
            (field as any).unique = true;
        }
        result[key] = field;
    }
    return result;
}

/**
 * Builds the KuluPay database schema dynamically from user options.
 * Merges base fields with user-provided `additionalFields` and custom `modelName` values.
 *
 * @param options - The KuluPay configuration options.
 * @returns A Farming ORM schema definition for payment, customer, and subscription tables.
 *
 * @example
 * ```ts
 * const schema = getKuluPayTables({
 *   database: prisma,
 *   payment: {
 *     modelName: "payments",
 *     additionalFields: { description: { type: "string", required: false } }
 *   }
 * });
 * ```
 */
export const getKuluPayTables = (options: KuluPayOptions) => {
    const paymentModelName = options.payment?.modelName || "payment";
    const customerModelName = options.customer?.modelName || "customer";
    const subscriptionModelName = options.subscription?.modelName || "subscription";

    return defineSchema({
        payment: model({
            table: paymentModelName,
            fields: {
                id: id(),
                userId: string(),
                amount: decimal(),
                currency: string(),
                status: string(),
                providerId: string(),
                metadata: json(),
                type: string(),
                description: string().nullable(),
                customerId: string().nullable(),
                providerPaymentId: string().nullable(),
                clientSecret: string().nullable(),
                txHash: string().nullable(),
                createdAt: datetime(),
                updatedAt: datetime(),
                ...buildAdditionalFields(options.payment?.additionalFields),
            },
            constraints: {
                indexes: [
                    ["userId", "status"],
                    ["providerId", "providerPaymentId"],
                ],
            },
            relations: {
                customer: belongsTo("customer", { foreignKey: "customerId" }),
            },
        }),
        customer: model({
            table: customerModelName,
            fields: {
                id: id(),
                userId: string().unique(),
                providerId: string(),
                providerCustomerId: string(),
                createdAt: datetime(),
                updatedAt: datetime(),
                ...buildAdditionalFields(options.customer?.additionalFields),
            },
            relations: {
                payments: hasMany("payment", { foreignKey: "customerId" }),
                subscriptions: hasMany("subscription", { foreignKey: "userId" }),
            },
        }),
        subscription: model({
            table: subscriptionModelName,
            fields: {
                id: id(),
                userId: string(),
                planId: string(),
                status: string(),
                providerSubscriptionId: string().unique(),
                currentPeriodEnd: datetime(),
                cancelAtPeriodEnd: boolean(),
                createdAt: datetime(),
                updatedAt: datetime(),
                ...buildAdditionalFields(options.subscription?.additionalFields),
            },
            constraints: {
                indexes: [
                    ["userId", "status"],
                ],
            },
            relations: {
                customer: belongsTo("customer", { foreignKey: "userId" }),
            },
        })
    });
};

export type DynamicKuluPaySchema = ReturnType<typeof getKuluPayTables>;
