import { defineSchema, model, id, string, decimal, datetime, boolean, json } from "@farming-labs/orm";

/**
 * The static base schema for KuluPay.
 * Contains the default fields for payment, customer, and subscription tables.
 * For dynamic schema generation with custom fields, use `getKuluPayTables()` instead.
 */
export const kuluPaySchema = defineSchema({
    payment: model({
        table: "payment",
        fields: {
            id: id(),
            userId: string(),
            amount: decimal(),
            currency: string(),
            status: string(), // pending, succeeded, failed, etc.
            providerId: string(),
            metadata: json(),
            createdAt: datetime(),
            updatedAt: datetime(),
        }
    }),
    customer: model({
        table: "customer",
        fields: {
            id: id(),
            userId: string().unique(),
            providerId: string(),
            providerCustomerId: string(),
            createdAt: datetime(),
            updatedAt: datetime(),
        }
    }),
    subscription: model({
        table: "subscription",
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
        }
    })
});

export type KuluPaySchema = typeof kuluPaySchema;
